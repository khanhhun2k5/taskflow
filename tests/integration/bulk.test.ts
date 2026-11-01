import { beforeAll, describe, expect, it } from "vitest";
import type { BulkResult } from "@/server/services/tasks";
import { keysForAppend } from "@/lib/ordering";
import { prisma } from "@/server/db";
import { api, errorCode, type TestUser } from "./api";
import { createProject, createTask, newUser, snapshot } from "./fixtures";
import { assertInvariants } from "./invariants";

let user: TestUser;

beforeAll(async () => {
  user = await newUser("Bulk User");
});

describe("bulk updates (BR-31)", () => {
  it("TC-17 a batch with an unknown third id changes nothing", async () => {
    const a = await createTask(user, { title: "A" });
    const b = await createTask(user, { title: "B" });
    const before = await snapshot(user.id);

    const response = await api(user, "POST", "/tasks/bulk", {
      ids: [a.id, b.id, "does-not-exist"],
      action: { type: "setPriority", priority: "URGENT" },
    });
    expect(response.status).toBe(404);
    expect(await snapshot(user.id)).toEqual(before);
  });

  it("a failing rule rolls back the whole batch (setStatus on a board task)", async () => {
    const fx = await createProject(user, "Mixed");
    const inbox = await createTask(user, { title: "Inbox" });
    const onBoard = await createTask(user, { title: "Board", columnId: fx.todo.id });
    const before = await snapshot(user.id);

    const response = await api(user, "POST", "/tasks/bulk", {
      ids: [inbox.id, onBoard.id],
      action: { type: "setStatus", status: "DONE" },
    });
    expect(response.status).toBe(422);
    expect(errorCode(response)).toBe("TASK_ON_BOARD");
    expect(await snapshot(user.id)).toEqual(before);
  });

  it("200 ids are accepted; 201 ids are rejected with 400", async () => {
    const keys = keysForAppend(200);
    await prisma.task.createMany({
      data: keys.map((order, i) => ({ userId: user.id, title: `Bulk ${i}`, order })),
    });
    const ids = (
      await prisma.task.findMany({
        where: { userId: user.id, title: { startsWith: "Bulk " } },
        select: { id: true },
      })
    ).map((row) => row.id);
    expect(ids).toHaveLength(200);

    const ok = await api<BulkResult>(user, "POST", "/tasks/bulk", {
      ids,
      action: { type: "setPriority", priority: "LOW" },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.updated).toBe(200);
    expect(await prisma.task.count({ where: { id: { in: ids }, priority: "LOW" } })).toBe(200);

    const tooMany = await api(user, "POST", "/tasks/bulk", {
      ids: [...ids, "one-more"],
      action: { type: "setPriority", priority: "HIGH" },
    });
    expect(tooMany.status).toBe(400);
    expect(errorCode(tooMany)).toBe("VALIDATION_ERROR");
  });

  it("move, labels, due date and delete work on every selected task", async () => {
    const fx = await createProject(user, "Bulk ops");
    const tasks = await Promise.all(
      ["1", "2", "3"].map((title) => createTask(user, { title, columnId: fx.todo.id })),
    );
    const ids = tasks.map((task) => task.id);
    const label = await api<{ id: string }>(user, "POST", "/labels", { name: "Bulk label" });

    const moved = await api<BulkResult>(user, "POST", "/tasks/bulk", {
      ids,
      action: { type: "move", columnId: fx.done.id },
    });
    expect(moved.status).toBe(200);
    expect(await prisma.task.count({ where: { id: { in: ids }, statusCategory: "DONE" } })).toBe(3);
    await assertInvariants(user.id);

    await api(user, "POST", "/tasks/bulk", {
      ids,
      action: { type: "addLabel", labelId: label.body.id },
    });
    await api(user, "POST", "/tasks/bulk", {
      ids,
      action: { type: "addLabel", labelId: label.body.id },
    });
    expect(await prisma.taskLabel.count({ where: { taskId: { in: ids } } })).toBe(3);
    await api(user, "POST", "/tasks/bulk", {
      ids,
      action: { type: "removeLabel", labelId: label.body.id },
    });
    expect(await prisma.taskLabel.count({ where: { taskId: { in: ids } } })).toBe(0);

    const due = "2026-12-24T00:00:00.000Z";
    await api(user, "POST", "/tasks/bulk", { ids, action: { type: "setDue", dueAt: due } });
    expect(
      await prisma.activityLog.count({ where: { taskId: { in: ids }, type: "DUE_CHANGED" } }),
    ).toBe(3);

    await api(user, "POST", "/tasks/bulk", { ids, action: { type: "delete" } });
    expect(await prisma.task.count({ where: { id: { in: ids }, deletedAt: null } })).toBe(0);
    await assertInvariants(user.id);
  });

  it("setStatus works for tasks without a column (BR-02)", async () => {
    const tasks = await Promise.all(["i1", "i2"].map((title) => createTask(user, { title })));
    const response = await api(user, "POST", "/tasks/bulk", {
      ids: tasks.map((task) => task.id),
      action: { type: "setStatus", status: "DONE" },
    });
    expect(response.status).toBe(200);
    await assertInvariants(user.id);
  });
});
