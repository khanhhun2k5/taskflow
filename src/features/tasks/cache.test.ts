import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { BoardDTO } from "@/features/boards/schemas";
import { queryKeys } from "@/features/query-keys";
import type { Page } from "@/lib/pagination";
import {
  draftTask,
  insertTaskInCaches,
  moveTaskInBoard,
  patchTaskInCaches,
  removeTaskFromCaches,
  replaceTaskInCaches,
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
  const inbox = queryKeys.tasks.list({ inbox: true });
  qc.setQueryData<Page<TaskDTO>>(inbox, { items: [task("a"), task("b")], nextCursor: null });
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
      column("todo", "TODO", [task("k", { columnId: "todo" })]),
      column("done", "DONE", []),
    ],
  };
  qc.setQueryData(queryKeys.boards.detail("board"), board);
  const read = {
    inbox: () => qc.getQueryData<Page<TaskDTO>>(inbox)?.items ?? [],
    detail: () => qc.getQueryData<TaskDetailDTO>(queryKeys.tasks.detail("p")),
    board: () => qc.getQueryData<BoardDTO>(queryKeys.boards.detail("board")),
  };
  return { qc, read };
}

describe("task cache helpers", () => {
  it("patches a task wherever it is cached", () => {
    const { qc, read } = seed();
    patchTaskInCaches(qc, "a", { title: "A2" });
    patchTaskInCaches(qc, "s", { title: "S2" });
    patchTaskInCaches(qc, "k", { title: "K2" });
    expect(read.inbox().map((t) => t.title)).toEqual(["A2", "b"]);
    expect(read.detail()?.subtasks[0].title).toBe("S2");
    expect(read.board()?.columns[0].tasks[0].title).toBe("K2");
  });

  it("builds status patches (BR-03)", () => {
    expect(statusPatch("DONE", NOW)).toEqual({
      statusCategory: "DONE",
      completedAt: NOW,
      isOverdue: false,
    });
    expect(statusPatch("TODO", NOW)).toEqual({ statusCategory: "TODO", completedAt: null });
  });

  it("inserts optimistic tasks in the inbox, the first TODO column, or the parent", () => {
    const { qc, read } = seed();
    insertTaskInCaches(qc, task("temp-1"), { kind: "inbox" });
    insertTaskInCaches(qc, task("temp-2"), {
      kind: "project",
      projectId: "proj",
      boardId: "board",
    });
    insertTaskInCaches(qc, task("temp-3"), { kind: "subtask", parentId: "p" });
    expect(read.inbox().map((t) => t.id)).toEqual(["a", "b", "temp-1"]);
    expect(read.board()?.columns[0].tasks.map((t) => [t.id, t.columnId])).toEqual([
      ["k", "todo"],
      ["temp-2", "todo"],
    ]);
    expect(read.detail()?.subtasks.map((t) => t.id)).toEqual(["s", "temp-3"]);
    expect(read.detail()?.subtaskCount.total).toBe(2);
  });

  it("replaces the optimistic row with the server task", () => {
    const { qc, read } = seed();
    insertTaskInCaches(qc, task("temp-1"), { kind: "inbox" });
    replaceTaskInCaches(qc, "temp-1", task("real"));
    expect(read.inbox().map((t) => t.id)).toEqual(["a", "b", "real"]);
  });

  it("removes a deleted subtask and updates the parent counter", () => {
    const { qc, read } = seed();
    removeTaskFromCaches(qc, { id: "s", parentId: "p" });
    expect(read.detail()?.subtasks).toEqual([]);
    expect(read.detail()?.subtaskCount.total).toBe(0);
    removeTaskFromCaches(qc, { id: "a", parentId: null });
    expect(read.inbox().map((t) => t.id)).toEqual(["b"]);
  });

  it("moves a task to the end of another column with its status", () => {
    const { qc, read } = seed();
    moveTaskInBoard(qc, "board", "k", { id: "done", statusCategory: "DONE" });
    const [todo, done] = read.board()?.columns ?? [];
    expect(todo.tasks).toEqual([]);
    expect(done.tasks.map((t) => [t.id, t.columnId, t.statusCategory])).toEqual([
      ["k", "done", "DONE"],
    ]);
    moveTaskInBoard(qc, "board", "missing", { id: "todo", statusCategory: "TODO" });
    expect(read.board()?.columns[1].tasks).toHaveLength(1);
  });
});
