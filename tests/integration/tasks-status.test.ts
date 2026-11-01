import { beforeAll, describe, expect, it } from "vitest";
import type { BoardDTO } from "@/features/boards/schemas";
import type { TaskDTO, WithWarnings } from "@/features/tasks/schemas";
import type { TaskDetailDTO } from "@/server/services/tasks";
import { prisma } from "@/server/db";
import { api, errorCode, type TestUser } from "./api";
import { createProject, createTask, newUser, type ProjectFixture } from "./fixtures";
import { assertInvariants } from "./invariants";

let user: TestUser;
let fx: ProjectFixture;

beforeAll(async () => {
  user = await newUser("Status User");
  fx = await createProject(user);
});

async function statusLogs(taskId: string) {
  return prisma.activityLog.findMany({
    where: { taskId, type: "STATUS_CHANGED" },
    orderBy: { at: "asc" },
  });
}

describe("status changes (BR-01, BR-03, BR-95, ADR-03)", () => {
  it("BR-27 a project task without columnId lands in the first TODO column", async () => {
    const task = await createTask(user, { title: "Landing", projectId: fx.project.id });
    expect(task.columnId).toBe(fx.todo.id);
    expect(task.statusCategory).toBe("TODO");
    expect(task.warnings).toEqual([]);
    await assertInvariants(user.id);
  });

  it("TC-12 moving TODO → DONE sets DONE, completedAt and an ActivityLog entry", async () => {
    const task = await createTask(user, { title: "Report", projectId: fx.project.id });
    const moved = await api<WithWarnings<TaskDTO>>(user, "POST", `/tasks/${task.id}/move`, {
      columnId: fx.done.id,
      beforeId: null,
      afterId: null,
    });
    expect(moved.status).toBe(200);
    expect(moved.body.statusCategory).toBe("DONE");
    expect(moved.body.completedAt).not.toBeNull();
    expect(moved.body.columnId).toBe(fx.done.id);

    const logs = await statusLogs(task.id);
    expect(logs.map((log) => [log.fromValue, log.toValue])).toEqual([
      [{ statusCategory: "TODO" }, { statusCategory: "DONE" }],
    ]);
    await assertInvariants(user.id);
  });

  it("TC-12b moving back DONE → IN_PROGRESS clears completedAt", async () => {
    const task = await createTask(user, { title: "Back", columnId: fx.done.id });
    expect(task.completedAt).not.toBeNull();
    const moved = await api<TaskDTO>(user, "POST", `/tasks/${task.id}/move`, {
      columnId: fx.inProgress.id,
      beforeId: null,
      afterId: null,
    });
    expect(moved.body.statusCategory).toBe("IN_PROGRESS");
    expect(moved.body.completedAt).toBeNull();
    await assertInvariants(user.id);
  });

  it("TC-12c changing a column IN_PROGRESS → DONE updates every task in one transaction", async () => {
    const own = await createProject(user, "Column switch");
    const tasks = await Promise.all(
      ["A", "B", "C"].map((title) => createTask(user, { title, columnId: own.inProgress.id })),
    );
    const response = await api(user, "PATCH", `/columns/${own.inProgress.id}`, {
      statusCategory: "DONE",
    });
    expect(response.status).toBe(200);

    const rows = await prisma.task.findMany({ where: { id: { in: tasks.map((t) => t.id) } } });
    expect(rows.every((row) => row.statusCategory === "DONE" && row.completedAt !== null)).toBe(
      true,
    );
    expect(
      await prisma.activityLog.count({
        where: { taskId: { in: tasks.map((t) => t.id) }, type: "STATUS_CHANGED" },
      }),
    ).toBe(3);
    await assertInvariants(user.id);
  });

  it("moving within a column keeps the status and writes no status log", async () => {
    const first = await createTask(user, { title: "First", columnId: fx.inProgress.id });
    const second = await createTask(user, { title: "Second", columnId: fx.inProgress.id });
    const moved = await api<TaskDTO>(user, "POST", `/tasks/${second.id}/move`, {
      columnId: fx.inProgress.id,
      beforeId: null,
      afterId: first.id,
    });
    expect(moved.status).toBe(200);
    expect(moved.body.order < first.order).toBe(true);
    expect(await statusLogs(second.id)).toHaveLength(0);

    const board = await api<BoardDTO>(user, "GET", `/boards/${fx.boardId}`);
    const ids = board.body.columns.find((c) => c.id === fx.inProgress.id)?.tasks.map((t) => t.id);
    expect(ids?.indexOf(second.id)).toBeLessThan(ids?.indexOf(first.id) ?? -1);
    await assertInvariants(user.id);
  });

  it("a stale beforeId/afterId pair cannot create duplicate keys", async () => {
    const own = await createProject(user, "Stale");
    const a = await createTask(user, { title: "a", columnId: own.todo.id });
    const b = await createTask(user, { title: "b", columnId: own.todo.id });
    const c = await createTask(user, { title: "c", columnId: own.todo.id });
    // Client thinks c sits right after a (it does not: b is in between).
    await api(user, "POST", `/tasks/${c.id}/move`, {
      columnId: own.todo.id,
      beforeId: a.id,
      afterId: b.id,
    });
    const board = await api<BoardDTO>(user, "GET", `/boards/${own.boardId}`);
    const orders = board.body.columns[0].tasks.map((t) => t.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("rejects neighbours that are not in the target column", async () => {
    const task = await createTask(user, { title: "Lost", columnId: fx.todo.id });
    const other = await createTask(user, { title: "Elsewhere", columnId: fx.done.id });
    const response = await api(user, "POST", `/tasks/${task.id}/move`, {
      columnId: fx.todo.id,
      beforeId: other.id,
      afterId: null,
    });
    expect(response.status).toBe(400);
  });

  it("BR-02 tasks without a column change status directly; board tasks cannot", async () => {
    const inbox = await createTask(user, { title: "Inbox" });
    const done = await api<TaskDTO>(user, "PATCH", `/tasks/${inbox.id}`, {
      statusCategory: "DONE",
    });
    expect(done.body.statusCategory).toBe("DONE");
    expect(done.body.completedAt).not.toBeNull();
    const reopened = await api<TaskDTO>(user, "PATCH", `/tasks/${inbox.id}`, {
      statusCategory: "TODO",
    });
    expect(reopened.body.completedAt).toBeNull();
    expect(await statusLogs(inbox.id)).toHaveLength(2);

    const onBoard = await createTask(user, { title: "Board", columnId: fx.todo.id });
    const refused = await api(user, "PATCH", `/tasks/${onBoard.id}`, { statusCategory: "DONE" });
    expect(refused.status).toBe(422);
    expect(errorCode(refused)).toBe("TASK_ON_BOARD");
    await assertInvariants(user.id);
  });
});

describe("subtasks (BR-05, BR-06, BR-07)", () => {
  it("TC-14 a subtask of a subtask is rejected", async () => {
    const parent = await createTask(user, { title: "Parent", projectId: fx.project.id });
    const child = await createTask(user, { title: "Child", parentId: parent.id });
    expect(child.projectId).toBe(fx.project.id);
    expect(child.columnId).toBeNull();

    const response = await api(user, "POST", "/tasks", { title: "Grandchild", parentId: child.id });
    expect(response.status).toBe(422);
    expect(errorCode(response)).toBe("SUBTASK_DEPTH_EXCEEDED");
    await assertInvariants(user.id);
  });

  it("subtasks follow the parent when it changes project (BR-06)", async () => {
    const target = await createProject(user, "Target");
    const parent = await createTask(user, { title: "Moving parent", columnId: fx.inProgress.id });
    const child = await createTask(user, { title: "Moving child", parentId: parent.id });

    const moved = await api<WithWarnings<TaskDTO>>(user, "PATCH", `/tasks/${parent.id}`, {
      projectId: target.project.id,
    });
    expect(moved.status).toBe(200);
    expect(moved.body.columnId).toBe(target.inProgress.id); // same status group
    const childRow = await prisma.task.findUniqueOrThrow({ where: { id: child.id } });
    expect(childRow.projectId).toBe(target.project.id);

    const toInbox = await api<TaskDTO>(user, "PATCH", `/tasks/${parent.id}`, { projectId: null });
    expect(toInbox.body.columnId).toBeNull();
    expect(toInbox.body.projectId).toBeNull();
    await assertInvariants(user.id);
  });

  it("GET /tasks/:id returns subtasks, labels and recent activity", async () => {
    const parent = await createTask(user, { title: "Detail", projectId: fx.project.id });
    await createTask(user, { title: "Sub", parentId: parent.id });
    const detail = await api<TaskDetailDTO>(user, "GET", `/tasks/${parent.id}`);
    expect(detail.body.subtasks.map((t) => t.title)).toEqual(["Sub"]);
    expect(detail.body.subtaskCount).toEqual({ total: 1, done: 0 });
    expect(detail.body.activity[0]?.type).toBe("TASK_CREATED");
  });
});

describe("delete and restore (BR-09, BR-10)", () => {
  it("TC-16 restoring a parent brings back only subtasks deleted with it", async () => {
    const parent = await createTask(user, { title: "P", projectId: fx.project.id });
    const [c1, c2, c3] = await Promise.all(
      ["C1", "C2", "C3"].map((title) => createTask(user, { title, parentId: parent.id })),
    );

    expect((await api(user, "DELETE", `/tasks/${c1.id}`)).status).toBe(204);
    expect((await api(user, "DELETE", `/tasks/${parent.id}`)).status).toBe(204);

    const rows = await prisma.task.findMany({ where: { id: { in: [parent.id, c2.id, c3.id] } } });
    const stamps = new Set(rows.map((row) => row.deletedAt?.getTime()));
    expect(stamps.size).toBe(1); // one shared deletedAt
    expect((await api(user, "GET", `/tasks/${c2.id}`)).status).toBe(404);

    const restored = await api<TaskDTO>(user, "POST", `/tasks/${parent.id}/restore`);
    expect(restored.status).toBe(200);
    const after = await prisma.task.findMany({ where: { parentId: parent.id } });
    const live = after
      .filter((row) => row.deletedAt === null)
      .map((row) => row.title)
      .sort();
    expect(live).toEqual(["C2", "C3"]);

    // c1 was deleted earlier on its own; it can still be restored by itself.
    expect((await api(user, "POST", `/tasks/${c1.id}/restore`)).status).toBe(200);
    await assertInvariants(user.id);
  });

  it("a subtask cannot be restored while its parent is deleted", async () => {
    const parent = await createTask(user, { title: "Gone parent" });
    const child = await createTask(user, { title: "Orphan", parentId: parent.id });
    await api(user, "DELETE", `/tasks/${parent.id}`);
    const response = await api(user, "POST", `/tasks/${child.id}/restore`);
    expect(response.status).toBe(422);
    expect(errorCode(response)).toBe("PARENT_DELETED");
  });

  it("logs DELETED and RESTORED (BR-95)", async () => {
    const task = await createTask(user, { title: "Logged" });
    await api(user, "DELETE", `/tasks/${task.id}`);
    await api(user, "POST", `/tasks/${task.id}/restore`);
    const types = await prisma.activityLog.findMany({
      where: { taskId: task.id },
      orderBy: { at: "asc" },
    });
    expect(types.map((log) => log.type)).toEqual(["TASK_CREATED", "DELETED", "RESTORED"]);
  });

  it("logs estimate and due date changes (BR-95)", async () => {
    const task = await createTask(user, { title: "Estimate", estimate: 2 });
    await api(user, "PATCH", `/tasks/${task.id}`, {
      estimate: 5,
      dueAt: "2026-12-01T00:00:00.000Z",
    });
    const logs = await prisma.activityLog.findMany({
      where: { taskId: task.id },
      orderBy: { type: "asc" },
    });
    expect(logs.map((log) => log.type).sort()).toEqual([
      "DUE_CHANGED",
      "ESTIMATE_CHANGED",
      "TASK_CREATED",
    ]);
    const detail = await api<TaskDTO>(user, "GET", `/tasks/${task.id}`);
    expect(detail.body.estimate).toBe(5); // Decimal → number at the service boundary
  });
});
