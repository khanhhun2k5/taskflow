// Concurrent writes must keep the docs/04 section 4 invariants (review of MVP-1b): columns are
// locked first, then task rows, and only values read after locking are used.
import { beforeAll, describe, expect, it } from "vitest";
import type { ColumnDTO } from "@/features/boards/schemas";
import { prisma } from "@/server/db";
import { api, type TestUser } from "./api";
import { createProject, createTask, newUser } from "./fixtures";
import { assertInvariants } from "./invariants";

let user: TestUser;
const ROUNDS = 8;

beforeAll(async () => {
  user = await newUser("Concurrency User");
});

const moveBody = (columnId: string) => ({ columnId, beforeId: null, afterId: null });

describe("concurrent writes keep invariant 1 (status = column status)", () => {
  it("moveTask ∥ updateColumn(statusCategory)", async () => {
    const fx = await createProject(user, "Move vs regroup");
    const extra = await api<ColumnDTO>(user, "POST", `/boards/${fx.boardId}/columns`, {
      name: "Flip",
      statusCategory: "IN_PROGRESS",
    });
    let status: "DONE" | "IN_PROGRESS" = "DONE";
    for (let round = 0; round < ROUNDS; round += 1) {
      const task = await createTask(user, { title: `R${round}`, columnId: fx.todo.id });
      await Promise.all([
        api(user, "POST", `/tasks/${task.id}/move`, moveBody(extra.body.id)),
        api(user, "PATCH", `/columns/${extra.body.id}`, { statusCategory: status }),
      ]);
      status = status === "DONE" ? "IN_PROGRESS" : "DONE";
      await assertInvariants(user.id);
    }
  });

  it("moveTask ∥ deleteColumn: a live task never loses its column", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const fx = await createProject(user, `Move vs delete ${round}`);
      const task = await createTask(user, { title: "Mover", columnId: fx.todo.id });
      const [moved, deleted] = await Promise.all([
        api(user, "POST", `/tasks/${task.id}/move`, moveBody(fx.inProgress.id)),
        api(user, "DELETE", `/columns/${fx.inProgress.id}`),
      ]);
      // Either the move wins (delete then sees a live task → 400) or the delete wins (→ 404).
      expect([moved.status, deleted.status].sort()).toSatisfy(
        (pair: number[]) =>
          JSON.stringify(pair) === "[200,400]" || JSON.stringify(pair) === "[200,404]",
      );
      await assertInvariants(user.id);
    }
  });

  it("two moves of the same task to different columns", async () => {
    const fx = await createProject(user, "Double move");
    for (let round = 0; round < ROUNDS; round += 1) {
      const task = await createTask(user, { title: `D${round}`, columnId: fx.inProgress.id });
      await Promise.all([
        api(user, "POST", `/tasks/${task.id}/move`, moveBody(fx.done.id)),
        api(user, "POST", `/tasks/${task.id}/move`, moveBody(fx.todo.id)),
      ]);
      await assertInvariants(user.id);
    }
  });

  it("bulk moves with the same ids in opposite order do not deadlock", async () => {
    const fx = await createProject(user, "Bulk order");
    const x = await createTask(user, { title: "X", columnId: fx.todo.id });
    const y = await createTask(user, { title: "Y", columnId: fx.todo.id });
    for (let round = 0; round < ROUNDS; round += 1) {
      const target = round % 2 === 0 ? fx.done.id : fx.inProgress.id;
      const results = await Promise.all([
        api(user, "POST", "/tasks/bulk", {
          ids: [x.id, y.id],
          action: { type: "move", columnId: target },
        }),
        api(user, "POST", "/tasks/bulk", {
          ids: [y.id, x.id],
          action: { type: "move", columnId: target },
        }),
      ]);
      expect(results.map((result) => result.status)).toEqual([200, 200]);
      await assertInvariants(user.id);
    }
    expect(await prisma.task.count({ where: { id: { in: [x.id, y.id] }, columnId: null } })).toBe(
      0,
    );
  });
});
