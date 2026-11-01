import { beforeAll, describe, expect, it } from "vitest";
import type { TaskDTO, WithWarnings } from "@/features/tasks/schemas";
import { prisma } from "@/server/db";
import { api, errorCode, type TestUser } from "./api";
import { createProject, createTask, newUser, setColumnWip } from "./fixtures";
import { assertInvariants } from "./invariants";

let user: TestUser;

beforeAll(async () => {
  user = await newUser("WIP User");
});

/** A project whose IN_PROGRESS column holds `count` tasks and has the given WIP limit. */
async function columnWith(count: number, wipLimit: number, wipStrict: boolean) {
  const fx = await createProject(user, `WIP ${wipLimit} ${wipStrict}`);
  const tasks = [];
  for (let i = 0; i < count; i += 1) {
    tasks.push(await createTask(user, { title: `In ${i}`, columnId: fx.inProgress.id }));
  }
  await setColumnWip(user, fx.inProgress.id, wipLimit, wipStrict);
  const outside = await createTask(user, { title: "Outside", columnId: fx.todo.id });
  return { fx, tasks, outside };
}

const liveParents = (columnId: string) =>
  prisma.task.count({ where: { columnId, deletedAt: null, parentId: null } });

describe("WIP limits over HTTP (BR-28…BR-30)", () => {
  it("TC-20 full column in warning mode → 200 with warnings", async () => {
    const { fx, outside } = await columnWith(3, 3, false);
    const response = await api<WithWarnings<TaskDTO>>(user, "POST", `/tasks/${outside.id}/move`, {
      columnId: fx.inProgress.id,
      beforeId: null,
      afterId: null,
    });
    expect(response.status).toBe(200);
    expect(response.body.warnings).toEqual(["WIP_LIMIT_EXCEEDED"]);
    expect(await liveParents(fx.inProgress.id)).toBe(4);
    await assertInvariants(user.id);
  });

  it("TC-21 full strict column → 409 WIP_LIMIT_EXCEEDED and the task does not move", async () => {
    const { fx, outside } = await columnWith(3, 3, true);
    const response = await api(user, "POST", `/tasks/${outside.id}/move`, {
      columnId: fx.inProgress.id,
      beforeId: null,
      afterId: null,
    });
    expect(response.status).toBe(409);
    expect(errorCode(response)).toBe("WIP_LIMIT_EXCEEDED");
    const row = await prisma.task.findUniqueOrThrow({ where: { id: outside.id } });
    expect(row.columnId).toBe(fx.todo.id);
    expect(row.statusCategory).toBe("TODO");

    const created = await api(user, "POST", "/tasks", { title: "New", columnId: fx.inProgress.id });
    expect(created.status).toBe(409);
    await assertInvariants(user.id);
  });

  it("TC-21b two concurrent moves into a strict column with one free slot → one 200, one 409", async () => {
    const fx = await createProject(user, "Race");
    await createTask(user, { title: "R1", columnId: fx.inProgress.id });
    await createTask(user, { title: "R2", columnId: fx.inProgress.id });
    await setColumnWip(user, fx.inProgress.id, 3, true);
    const a = await createTask(user, { title: "A", columnId: fx.todo.id });
    const b = await createTask(user, { title: "B", columnId: fx.todo.id });

    const body = { columnId: fx.inProgress.id, beforeId: null, afterId: null };
    const results = await Promise.all([
      api(user, "POST", `/tasks/${a.id}/move`, body),
      api(user, "POST", `/tasks/${b.id}/move`, body),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(await liveParents(fx.inProgress.id)).toBe(3);
    await assertInvariants(user.id);
  });

  it("TC-22 reordering inside a full strict column is allowed", async () => {
    const { fx, tasks } = await columnWith(3, 3, true);
    const response = await api<WithWarnings<TaskDTO>>(user, "POST", `/tasks/${tasks[2].id}/move`, {
      columnId: fx.inProgress.id,
      beforeId: null,
      afterId: tasks[0].id,
    });
    expect(response.status).toBe(200);
    expect(response.body.warnings).toEqual([]);
    await assertInvariants(user.id);
  });

  it("TC-23 subtasks do not count: 3 parents with 2 subtasks each, limit 3 → not exceeded", async () => {
    const { fx, tasks } = await columnWith(3, 3, true);
    for (const parent of tasks) {
      await createTask(user, { title: `${parent.title}.a`, parentId: parent.id });
      await createTask(user, { title: `${parent.title}.b`, parentId: parent.id });
    }
    const reorder = await api<WithWarnings<TaskDTO>>(user, "POST", `/tasks/${tasks[0].id}/move`, {
      columnId: fx.inProgress.id,
      beforeId: tasks[2].id,
      afterId: null,
    });
    expect(reorder.status).toBe(200);
    expect(reorder.body.warnings).toEqual([]);
    await assertInvariants(user.id);
  });

  it("bulk move enforces the limit for the whole batch", async () => {
    const fx = await createProject(user, "Bulk WIP");
    await setColumnWip(user, fx.inProgress.id, 2, true);
    const tasks = await Promise.all(
      ["x", "y", "z"].map((title) => createTask(user, { title, columnId: fx.todo.id })),
    );
    const response = await api(user, "POST", "/tasks/bulk", {
      ids: tasks.map((task) => task.id),
      action: { type: "move", columnId: fx.inProgress.id },
    });
    expect(response.status).toBe(409);
    expect(await liveParents(fx.inProgress.id)).toBe(0);
    await assertInvariants(user.id);
  });

  it("deleting a column into a strict target that would overflow → 409", async () => {
    const fx = await createProject(user, "Delete WIP");
    await createTask(user, { title: "Moving", columnId: fx.inProgress.id });
    await createTask(user, { title: "Already", columnId: fx.todo.id });
    await setColumnWip(user, fx.todo.id, 1, true);
    const response = await api(user, "DELETE", `/columns/${fx.inProgress.id}?moveTo=${fx.todo.id}`);
    expect(response.status).toBe(409);
    expect(await prisma.column.count({ where: { id: fx.inProgress.id } })).toBe(1);
  });
});
