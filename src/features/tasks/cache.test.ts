import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { withPendingMoves } from "@/features/boards/hooks";
import type { BoardDTO } from "@/features/boards/schemas";
import { allItems, firstPage, type Pages } from "@/features/infinite";
import { queryKeys } from "@/features/query-keys";
import {
  draftTask,
  findCachedTask,
  insertTaskInCaches,
  moveTaskInCaches,
  patchTaskInCaches,
  removeTaskFromCaches,
  replaceTaskInCaches,
  setStatusInCaches,
  statusPatch,
} from "./cache";
import type { TaskDetailDTO, TaskDTO } from "./schemas";

const NOW = "2026-11-01T00:00:00.000Z";
const task = (id: string, fields: Partial<TaskDTO> = {}) => draftTask(id, id, fields, NOW);
const column = (id: string, statusCategory: TaskDTO["statusCategory"], tasks: TaskDTO[]) => ({
  id,
  name: id,
  statusCategory,
  order: id,
  wipLimit: null,
  wipStrict: false,
  tasks,
});

function seed() {
  const qc = new QueryClient();
  const inbox = queryKeys.tasks.list({ inbox: true }, {});
  // Two pages, as after scrolling once (infinite lists).
  qc.setQueryData<Pages<TaskDTO>>(inbox, {
    pages: [
      { items: [task("a")], nextCursor: "a" },
      { items: [task("b")], nextCursor: null },
    ],
    pageParams: [null, "a"],
  });
  qc.setQueryData(
    queryKeys.tasks.list({ projectId: "proj" }, { sort: "title" }),
    firstPage({ items: [task("k", { projectId: "proj" })], nextCursor: null }),
  );
  const detail: TaskDetailDTO = {
    ...task("p", { subtaskCount: { total: 1, done: 0 } }),
    subtasks: [task("s", { parentId: "p" })],
    activity: [],
  };
  qc.setQueryData(queryKeys.tasks.detail("p"), detail);
  const board: BoardDTO = {
    id: "board",
    projectId: "proj",
    courseId: null,
    columns: [
      column("todo", "TODO", [task("k", { columnId: "todo" }), task("m", { columnId: "todo" })]),
      column("done", "DONE", []),
    ],
  };
  qc.setQueryData(queryKeys.boards.detail("board"), board);
  const read = {
    inbox: () => allItems(qc.getQueryData<Pages<TaskDTO>>(inbox)),
    projectList: () =>
      allItems(
        qc.getQueryData<Pages<TaskDTO>>(
          queryKeys.tasks.list({ projectId: "proj" }, { sort: "title" }),
        ),
      ),
    detail: () => qc.getQueryData<TaskDetailDTO>(queryKeys.tasks.detail("p")),
    board: () => qc.getQueryData<BoardDTO>(queryKeys.boards.detail("board")),
  };
  return { qc, read };
}

const ids = (tasks: TaskDTO[] | undefined) => tasks?.map((t) => t.id);

describe("task cache helpers", () => {
  it("patches a task wherever it is cached, on every page", () => {
    const { qc, read } = seed();
    patchTaskInCaches(qc, "b", { title: "B2" });
    patchTaskInCaches(qc, "s", { title: "S2" });
    patchTaskInCaches(qc, "k", { title: "K2" });
    expect(read.inbox().map((t) => t.title)).toEqual(["a", "B2"]);
    expect(read.detail()?.subtasks[0].title).toBe("S2");
    expect(read.board()?.columns[0].tasks[0].title).toBe("K2");
    expect(read.projectList()[0].title).toBe("K2");
    expect(findCachedTask(qc, "b")?.title).toBe("B2");
    expect(findCachedTask(qc, "nope")).toBeUndefined();
  });

  it("builds status patches (BR-03) and keeps the parent's subtask counter in step", () => {
    expect(statusPatch("DONE", NOW)).toEqual({
      statusCategory: "DONE",
      completedAt: NOW,
      isOverdue: false,
    });
    expect(statusPatch("TODO", NOW)).toEqual({ statusCategory: "TODO", completedAt: null });
    const { qc, read } = seed();
    setStatusInCaches(qc, "s", "DONE", NOW);
    expect(read.detail()?.subtaskCount).toEqual({ total: 1, done: 1 });
    setStatusInCaches(qc, "s", "TODO", NOW);
    expect(read.detail()?.subtaskCount).toEqual({ total: 1, done: 0 });
  });

  it("inserts new tasks in inbox lists, project lists + the target column, or the parent", () => {
    const { qc, read } = seed();
    insertTaskInCaches(qc, task("temp-1"), { kind: "inbox" });
    insertTaskInCaches(qc, task("temp-2"), {
      kind: "project",
      projectId: "proj",
      boardId: "board",
    });
    insertTaskInCaches(qc, task("temp-3"), {
      kind: "project",
      projectId: "proj",
      boardId: "board",
      columnId: "done",
    });
    insertTaskInCaches(qc, task("temp-4"), { kind: "subtask", parentId: "p" });
    expect(ids(read.inbox())).toEqual(["a", "b", "temp-1"]);
    expect(ids(read.projectList())).toEqual(["k", "temp-2", "temp-3"]);
    expect(read.board()?.columns[0].tasks.map((t) => [t.id, t.columnId])).toEqual([
      ["k", "todo"],
      ["m", "todo"],
      ["temp-2", "todo"],
    ]);
    expect(read.board()?.columns[1].tasks.map((t) => [t.id, t.statusCategory])).toEqual([
      ["temp-3", "DONE"],
    ]);
    expect(ids(read.detail()?.subtasks)).toEqual(["s", "temp-4"]);
    expect(read.detail()?.subtaskCount.total).toBe(2);
  });

  it("replaces the optimistic row with the server task", () => {
    const { qc, read } = seed();
    insertTaskInCaches(qc, task("temp-1"), { kind: "inbox" });
    replaceTaskInCaches(qc, "temp-1", task("real"));
    expect(ids(read.inbox())).toEqual(["a", "b", "real"]);
  });

  it("removes a deleted subtask and updates the parent counter", () => {
    const { qc, read } = seed();
    setStatusInCaches(qc, "s", "DONE", NOW);
    removeTaskFromCaches(qc, { id: "s", parentId: "p" });
    expect(read.detail()?.subtasks).toEqual([]);
    expect(read.detail()?.subtaskCount).toEqual({ total: 0, done: 0 });
    removeTaskFromCaches(qc, { id: "a", parentId: null });
    expect(ids(read.inbox())).toEqual(["b"]);
  });

  it("moves a card to an index of another column and patches its status", () => {
    const { qc, read } = seed();
    moveTaskInCaches(
      qc,
      { id: "m", boardId: "board", target: { columnId: "done", index: 0 } },
      "DONE",
    );
    const [todo, done] = read.board()?.columns ?? [];
    expect(ids(todo.tasks)).toEqual(["k"]);
    expect(done.tasks.map((t) => [t.id, t.columnId, t.statusCategory])).toEqual([
      ["m", "done", "DONE"],
    ]);
    moveTaskInCaches(
      qc,
      { id: "m", boardId: "board", target: { columnId: "todo", index: 0 } },
      "TODO",
    );
    expect(ids(read.board()?.columns[0].tasks)).toEqual(["m", "k"]);
  });

  it("re-applies pending moves over refetched board data", () => {
    const { read } = seed();
    const board = read.board() as BoardDTO;
    const shown = withPendingMoves(board, [
      {
        id: "k",
        boardId: "board",
        target: { columnId: "done", index: 0 },
        statusCategory: "DONE",
        beforeId: null,
        afterId: null,
      },
    ]);
    expect(ids(shown.columns[1].tasks)).toEqual(["k"]);
    expect(shown.columns[1].tasks[0].statusCategory).toBe("DONE");
    expect(withPendingMoves(board, [])).toBe(board);
  });
});
