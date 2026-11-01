import { beforeAll, describe, expect, it } from "vitest";
import type { BoardDTO, ColumnDTO } from "@/features/boards/schemas";
import type {
  ProjectDTO,
  ProjectListItemDTO,
  ProjectProgressDTO,
} from "@/features/projects/schemas";
import type { TaskDTO } from "@/features/tasks/schemas";
import type { Page } from "@/lib/pagination";
import type { TrashItemDTO } from "@/features/tasks/schemas";
import { prisma } from "@/server/db";
import { api, errorCode, type TestUser } from "./api";
import { createProject, createTask, newUser } from "./fixtures";
import { assertInvariants } from "./invariants";

let user: TestUser;

beforeAll(async () => {
  user = await newUser("Project User");
});

describe("projects (BR-20…BR-22)", () => {
  it("BR-20 a new project gets a board with three columns named in the user's language", async () => {
    const vi = await createProject(user, "Tiếng Việt");
    expect([vi.todo, vi.inProgress, vi.done].map((c) => [c.name, c.statusCategory])).toEqual([
      ["Cần làm", "TODO"],
      ["Đang làm", "IN_PROGRESS"],
      ["Xong", "DONE"],
    ]);

    const english = await newUser("English User");
    await prisma.user.update({ where: { id: english.id }, data: { locale: "en" } });
    const en = await createProject(english, "English");
    expect([en.todo, en.inProgress, en.done].map((c) => c.name)).toEqual([
      "To do",
      "In progress",
      "Done",
    ]);
  });

  it("BR-22 an archived project is read-only until it is un-archived", async () => {
    const fx = await createProject(user, "Archive me");
    const task = await createTask(user, { title: "Inside", projectId: fx.project.id });
    expect(
      (await api(user, "PATCH", `/projects/${fx.project.id}`, { status: "ARCHIVED" })).status,
    ).toBe(200);

    const writes = await Promise.all([
      api(user, "POST", "/tasks", { title: "New", projectId: fx.project.id }),
      api(user, "PATCH", `/tasks/${task.id}`, { title: "Renamed" }),
      api(user, "POST", `/tasks/${task.id}/move`, {
        columnId: fx.done.id,
        beforeId: null,
        afterId: null,
      }),
      api(user, "DELETE", `/tasks/${task.id}`),
      api(user, "POST", `/boards/${fx.boardId}/columns`, {
        name: "QA",
        statusCategory: "IN_PROGRESS",
      }),
      api(user, "PATCH", `/columns/${fx.todo.id}`, { name: "Todo" }),
      api(user, "PATCH", `/projects/${fx.project.id}`, { name: "Renamed project" }),
    ]);
    expect(writes.map((response) => [response.status, errorCode(response)])).toEqual(
      writes.map(() => [422, "PROJECT_ARCHIVED"]),
    );
    // Reads still work.
    expect((await api(user, "GET", `/boards/${fx.boardId}`)).status).toBe(200);

    const unarchived = await api<ProjectDTO>(user, "PATCH", `/projects/${fx.project.id}`, {
      status: "ACTIVE",
      name: "Back",
    });
    expect(unarchived.status).toBe(200);
    expect(unarchived.body.name).toBe("Back");
  });

  it("delete and restore a project with the BR-10 deletedAt rule", async () => {
    const fx = await createProject(user, "Trash me");
    const keep = await createTask(user, {
      title: "Deleted with project",
      projectId: fx.project.id,
    });
    const early = await createTask(user, { title: "Deleted earlier", projectId: fx.project.id });
    await api(user, "DELETE", `/tasks/${early.id}`);
    expect((await api(user, "DELETE", `/projects/${fx.project.id}`)).status).toBe(204);
    expect((await api(user, "GET", `/projects/${fx.project.id}`)).status).toBe(404);
    expect((await api(user, "GET", `/boards/${fx.boardId}`)).status).toBe(404);

    const trash = await api<Page<TrashItemDTO>>(user, "GET", "/trash");
    const titles = trash.body.items.map((item) => item.title);
    expect(titles).toContain("Trash me");
    expect(titles).toContain("Deleted earlier");
    expect(titles).not.toContain("Deleted with project"); // restored through its project

    expect((await api(user, "POST", `/projects/${fx.project.id}/restore`)).status).toBe(200);
    const rows = await prisma.task.findMany({ where: { id: { in: [keep.id, early.id] } } });
    expect(rows.find((row) => row.id === keep.id)?.deletedAt).toBeNull();
    expect(rows.find((row) => row.id === early.id)?.deletedAt).not.toBeNull();
    await assertInvariants(user.id);
  });

  it("GET /projects lists progress and overdue counts", async () => {
    const fx = await createProject(user, "Listed");
    await createTask(user, {
      title: "Late",
      projectId: fx.project.id,
      dueAt: "2020-01-01T00:00:00.000Z",
    });
    const done = await createTask(user, { title: "Done", columnId: fx.done.id });
    expect(done.statusCategory).toBe("DONE");

    const list = await api<Page<ProjectListItemDTO>>(user, "GET", "/projects?limit=200");
    const item = list.body.items.find((project) => project.id === fx.project.id);
    expect(item?.overdueCount).toBe(1);
    expect(item?.progress).toBe(50); // no estimates → P (docs/07 section 3)
    expect(item?.weightedReliable).toBe(false);
  });

  it("GET /projects shows P_w and weightedReliable once half the tasks are estimated", async () => {
    const fx = await createProject(user, "Estimated");
    await createTask(user, { title: "Small", projectId: fx.project.id, estimate: 2 });
    await createTask(user, { title: "Big", columnId: fx.done.id, estimate: 6 });

    const list = await api<Page<ProjectListItemDTO>>(user, "GET", "/projects?limit=200");
    const item = list.body.items.find((project) => project.id === fx.project.id);
    expect(item?.weightedReliable).toBe(true);
    expect(item?.progress).toBe(75); // P_w = 6 / (2 + 6); P would be 50
  });
});

describe("progress (docs/07)", () => {
  it("GET /projects/:id/progress uses the docs/07 example 1 numbers", async () => {
    const fx = await createProject(user, "Progress");
    await createTask(user, { title: "2 points", projectId: fx.project.id, estimate: 2 });
    await createTask(user, { title: "3 points", projectId: fx.project.id, estimate: 3 });
    await createTask(user, { title: "5 points", columnId: fx.done.id, estimate: 5 });
    const late = await createTask(user, {
      title: "Milestone",
      projectId: fx.project.id,
      isMilestone: true,
      dueAt: "2020-01-01T00:00:00.000Z",
    });

    const progress = await api<ProjectProgressDTO>(
      user,
      "GET",
      `/projects/${fx.project.id}/progress`,
    );
    expect(progress.body.count).toBeCloseTo(100 / 3, 10);
    expect(progress.body.weighted).toBe(50);
    expect(progress.body.weightedReliable).toBe(true);
    expect([progress.body.done, progress.body.total]).toEqual([1, 3]);
    expect(progress.body.overdue.map((task) => task.id)).toEqual([late.id]);
  });
});

describe("columns (BR-25…BR-27)", () => {
  it("TC-15 the only DONE (or TODO) column cannot be deleted or regrouped", async () => {
    const fx = await createProject(user, "Columns");
    for (const response of [
      await api(user, "DELETE", `/columns/${fx.done.id}`),
      await api(user, "DELETE", `/columns/${fx.todo.id}`),
      await api(user, "PATCH", `/columns/${fx.done.id}`, { statusCategory: "IN_PROGRESS" }),
    ]) {
      expect(response.status).toBe(422);
      expect(errorCode(response)).toBe("BOARD_NEEDS_TODO_AND_DONE");
    }
  });

  it("BR-26 deleting a column with tasks needs moveTo; tasks take the target status", async () => {
    const fx = await createProject(user, "Delete column");
    const task = await createTask(user, { title: "Survivor", columnId: fx.inProgress.id });

    const missing = await api(user, "DELETE", `/columns/${fx.inProgress.id}`);
    expect(missing.status).toBe(400);

    const response = await api(user, "DELETE", `/columns/${fx.inProgress.id}?moveTo=${fx.done.id}`);
    expect(response.status).toBe(200);
    const moved = await api<TaskDTO>(user, "GET", `/tasks/${task.id}`);
    expect([moved.body.columnId, moved.body.statusCategory]).toEqual([fx.done.id, "DONE"]);
    await assertInvariants(user.id);
  });

  it("a task whose column was removed while it was deleted is re-homed on restore", async () => {
    const fx = await createProject(user, "Re-home");
    const task = await createTask(user, { title: "Away", columnId: fx.inProgress.id });
    await api(user, "DELETE", `/tasks/${task.id}`);
    expect((await api(user, "DELETE", `/columns/${fx.inProgress.id}`)).status).toBe(200);

    const restored = await api<TaskDTO>(user, "POST", `/tasks/${task.id}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body.columnId).toBe(fx.todo.id); // no IN_PROGRESS column left → first TODO
    expect(restored.body.statusCategory).toBe("TODO");
    await assertInvariants(user.id);
  });

  it("columns can be added between others and reordered", async () => {
    const fx = await createProject(user, "Order");
    const review = await api<ColumnDTO>(user, "POST", `/boards/${fx.boardId}/columns`, {
      name: "Review",
      statusCategory: "IN_PROGRESS",
      beforeId: fx.inProgress.id,
    });
    expect(review.status).toBe(201);
    let board = await api<BoardDTO>(user, "GET", `/boards/${fx.boardId}`);
    expect(board.body.columns.map((c) => c.name)).toEqual([
      "Cần làm",
      "Đang làm",
      "Review",
      "Xong",
    ]);

    await api(user, "POST", `/columns/${review.body.id}/move`, {
      beforeId: null,
      afterId: fx.todo.id,
    });
    board = await api<BoardDTO>(user, "GET", `/boards/${fx.boardId}`);
    expect(board.body.columns.map((c) => c.name)).toEqual([
      "Review",
      "Cần làm",
      "Đang làm",
      "Xong",
    ]);
  });
});

describe("GET /projects pagination", () => {
  it("an archived cursor project does not hide the next ACTIVE project", async () => {
    const pager = await newUser("Project pager");
    const created = [];
    for (let i = 0; i < 4; i += 1) created.push(await createProject(pager, `Page ${i}`));
    // Newest first: Page 3, Page 2, Page 1, Page 0.
    const first = await api<Page<ProjectListItemDTO>>(
      pager,
      "GET",
      "/projects?status=ACTIVE&limit=2",
    );
    expect(first.body.items.map((p) => p.name)).toEqual(["Page 3", "Page 2"]);

    await api(pager, "PATCH", `/projects/${first.body.items[1]?.id}`, { status: "ARCHIVED" });
    const second = await api<Page<ProjectListItemDTO>>(
      pager,
      "GET",
      `/projects?status=ACTIVE&limit=2&cursor=${first.body.nextCursor}`,
    );
    expect(second.body.items.map((p) => p.name)).toEqual(["Page 1", "Page 0"]);
    expect(created).toHaveLength(4);
  });
});
