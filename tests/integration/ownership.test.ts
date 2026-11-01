// TC-13 / US-03 / NFR-10: user B can never read or change user A's data. Every endpoint that
// takes an id (in the path or in the body) is listed; B gets 404 and A's rows stay identical.
import { beforeAll, describe, expect, it } from "vitest";
import type { LabelDTO } from "@/features/labels/schemas";
import type { Page } from "@/lib/pagination";
import type { TaskDTO } from "@/features/tasks/schemas";
import { api, type TestUser } from "./api";
import { createProject, createTask, newUser, snapshot, type ProjectFixture } from "./fixtures";
import { assertInvariants } from "./invariants";

let a: TestUser;
let b: TestUser;
const A = {} as {
  fx: ProjectFixture;
  task: TaskDTO;
  subtask: TaskDTO;
  deletedTask: TaskDTO;
  deletedProjectId: string;
  label: LabelDTO;
};
const B = {} as { fx: ProjectFixture; task: TaskDTO; inbox: TaskDTO };

beforeAll(async () => {
  a = await newUser("Owner A");
  b = await newUser("Intruder B");

  A.fx = await createProject(a, "A project");
  A.label = (await api<LabelDTO>(a, "POST", "/labels", { name: "A label" })).body;
  A.task = await createTask(a, { title: "A task", columnId: A.fx.todo.id, labelIds: [A.label.id] });
  A.subtask = await createTask(a, { title: "A subtask", parentId: A.task.id });
  A.deletedTask = await createTask(a, { title: "A deleted", projectId: A.fx.project.id });
  await api(a, "DELETE", `/tasks/${A.deletedTask.id}`);
  const doomed = await createProject(a, "A deleted project");
  await api(a, "DELETE", `/projects/${doomed.project.id}`);
  A.deletedProjectId = doomed.project.id;

  B.fx = await createProject(b, "B project");
  B.task = await createTask(b, { title: "B task", columnId: B.fx.todo.id });
  B.inbox = await createTask(b, { title: "B inbox" });
});

type Case = [method: "GET" | "POST" | "PATCH" | "DELETE", path: () => string, body?: () => unknown];

// Every route with :id (17 method + path pairs).
const PATH_CASES: Case[] = [
  ["GET", () => `/tasks/${A.task.id}`],
  ["PATCH", () => `/tasks/${A.task.id}`, () => ({ title: "hacked" })],
  ["DELETE", () => `/tasks/${A.task.id}`],
  ["POST", () => `/tasks/${A.deletedTask.id}/restore`],
  ["POST", () => `/tasks/${A.task.id}/restore`], // a live task of A
  [
    "POST",
    () => `/tasks/${A.task.id}/move`,
    () => ({ columnId: B.fx.done.id, beforeId: null, afterId: null }),
  ],
  ["GET", () => `/projects/${A.fx.project.id}`],
  ["PATCH", () => `/projects/${A.fx.project.id}`, () => ({ name: "hacked" })],
  ["DELETE", () => `/projects/${A.fx.project.id}`],
  ["POST", () => `/projects/${A.deletedProjectId}/restore`],
  ["GET", () => `/projects/${A.fx.project.id}/progress`],
  ["GET", () => `/boards/${A.fx.boardId}`],
  ["POST", () => `/boards/${A.fx.boardId}/columns`, () => ({ name: "x", statusCategory: "TODO" })],
  ["PATCH", () => `/columns/${A.fx.todo.id}`, () => ({ name: "hacked" })],
  ["DELETE", () => `/columns/${A.fx.inProgress.id}?moveTo=${A.fx.todo.id}`],
  ["DELETE", () => `/columns/${A.fx.inProgress.id}`],
  ["POST", () => `/columns/${A.fx.todo.id}/move`, () => ({ beforeId: null, afterId: null })],
  ["PATCH", () => `/labels/${A.label.id}`, () => ({ name: "hacked" })],
  ["DELETE", () => `/labels/${A.label.id}`],
];

// A's ids smuggled into the body (or query) of B's own requests.
const BODY_CASES: Case[] = [
  ["POST", () => "/tasks", () => ({ title: "x", projectId: A.fx.project.id })],
  ["POST", () => "/tasks", () => ({ title: "x", columnId: A.fx.todo.id })],
  ["POST", () => "/tasks", () => ({ title: "x", parentId: A.task.id })],
  ["POST", () => "/tasks", () => ({ title: "x", labelIds: [A.label.id] })],
  // B's own column with A's project: ownership is checked before consistency → 404, not 400.
  [
    "POST",
    () => "/tasks",
    () => ({ title: "x", columnId: B.fx.todo.id, projectId: A.fx.project.id }),
  ],
  ["POST", () => "/tasks", () => ({ title: "x", parentId: B.task.id, projectId: A.fx.project.id })],
  ["PATCH", () => `/tasks/${B.task.id}`, () => ({ projectId: A.fx.project.id })],
  ["PATCH", () => `/tasks/${B.task.id}`, () => ({ labelIds: [A.label.id] })],
  [
    "POST",
    () => `/tasks/${B.task.id}/move`,
    () => ({ columnId: A.fx.done.id, beforeId: null, afterId: null }),
  ],
  ["POST", () => "/tasks/bulk", () => ({ ids: [A.task.id], action: { type: "delete" } })],
  [
    "POST",
    () => "/tasks/bulk",
    () => ({ ids: [B.inbox.id], action: { type: "addLabel", labelId: A.label.id } }),
  ],
  [
    "POST",
    () => "/tasks/bulk",
    () => ({ ids: [B.inbox.id], action: { type: "removeLabel", labelId: A.label.id } }),
  ],
  [
    "POST",
    () => "/tasks/bulk",
    () => ({ ids: [B.task.id], action: { type: "move", columnId: A.fx.done.id } }),
  ],
  ["DELETE", () => `/columns/${B.fx.inProgress.id}?moveTo=${A.fx.todo.id}`],
];

describe("TC-13 another user's ids → 404, data unchanged", () => {
  it.each(PATH_CASES)("%s %s", async (method, path, body) => {
    const before = await snapshot(a.id);
    const response = await api(b, method, path(), body?.());
    expect(response.status).toBe(404);
    expect(await snapshot(a.id)).toEqual(before);
  });

  it.each(BODY_CASES)("%s %s with A's id in the request", async (method, path, body) => {
    const before = await snapshot(a.id);
    const response = await api(b, method, path(), body?.());
    expect(response.status).toBe(404);
    expect(await snapshot(a.id)).toEqual(before);
    await assertInvariants(b.id);
  });

  it("A's task as a drop neighbour in B's column is rejected (400, not in the column)", async () => {
    const before = await snapshot(a.id);
    const response = await api(b, "POST", `/tasks/${B.task.id}/move`, {
      columnId: B.fx.inProgress.id,
      beforeId: A.task.id,
      afterId: null,
    });
    expect(response.status).toBe(400);
    expect(await snapshot(a.id)).toEqual(before);
  });

  it("lists never include A's data, even when filtered by A's ids", async () => {
    const byProject = await api<Page<TaskDTO>>(b, "GET", `/tasks?projectId=${A.fx.project.id}`);
    expect(byProject.body.items).toEqual([]);
    const byParent = await api<Page<TaskDTO>>(b, "GET", `/tasks?parentId=${A.task.id}`);
    expect(byParent.body.items).toEqual([]);
    const byLabel = await api<Page<TaskDTO>>(b, "GET", `/tasks?labelId=${A.label.id}`);
    expect(byLabel.body.items).toEqual([]);
    // A's ids as cursors are unknown to B on every list.
    for (const path of [
      `/tasks?cursor=${A.task.id}`,
      `/projects?cursor=${A.fx.project.id}`,
      `/labels?cursor=${A.label.id}`,
      `/trash?cursor=${A.deletedTask.id}`,
    ]) {
      expect((await api(b, "GET", path)).status, path).toBe(400);
    }
    const labels = await api<Page<LabelDTO>>(b, "GET", "/labels");
    expect(labels.body.items.map((label) => label.id)).not.toContain(A.label.id);
    const trash = await api<Page<{ id: string }>>(b, "GET", "/trash");
    expect(trash.body.items.map((item) => item.id)).not.toContain(A.deletedTask.id);
  });

  it("A still owns intact, consistent data", async () => {
    await assertInvariants(a.id);
    const task = await api<TaskDTO>(a, "GET", `/tasks/${A.task.id}`);
    expect(task.body.title).toBe("A task");
  });
});
