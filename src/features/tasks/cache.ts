import type { QueryClient } from "@tanstack/react-query";
import type { BoardDTO } from "@/features/boards/schemas";
import { queryKeys } from "@/features/query-keys";
import type { Page } from "@/lib/pagination";
import type { StatusCategoryInput, TaskDetailDTO, TaskDTO } from "./schemas";

// Optimistic edits of every cached place a task can appear in: task lists, task details
// (and their `subtasks`), and board columns. Callers snapshot/restore (features/optimistic).

type TaskPage = Page<TaskDTO>;
type Updater = (task: TaskDTO) => TaskDTO;

function updateEverywhere(qc: QueryClient, update: Updater, drop?: (task: TaskDTO) => boolean) {
  const keep = (task: TaskDTO) => !drop?.(task);
  qc.setQueriesData<TaskPage>({ queryKey: queryKeys.tasks.lists }, (page) =>
    page ? { ...page, items: page.items.filter(keep).map(update) } : page,
  );
  qc.setQueriesData<TaskDetailDTO>({ queryKey: queryKeys.tasks.details }, (detail) =>
    detail
      ? { ...detail, ...update(detail), subtasks: detail.subtasks.filter(keep).map(update) }
      : detail,
  );
  qc.setQueriesData<BoardDTO>({ queryKey: queryKeys.boards.all }, (board) =>
    board
      ? {
          ...board,
          columns: board.columns.map((column) => ({
            ...column,
            tasks: column.tasks.filter(keep).map(update),
          })),
        }
      : board,
  );
}

export function patchTaskInCaches(qc: QueryClient, id: string, patch: Partial<TaskDTO>) {
  updateEverywhere(qc, (task) => (task.id === id ? { ...task, ...patch } : task));
}

/** Status shown before the server confirms; completedAt/isOverdue follow BR-03/BR-04 roughly. */
export function statusPatch(status: StatusCategoryInput, nowIso: string): Partial<TaskDTO> {
  return status === "DONE"
    ? { statusCategory: status, completedAt: nowIso, isOverdue: false }
    : { statusCategory: status, completedAt: null };
}

/** Status change of a task, keeping its parent's "done/total" counter in step. */
export function setStatusInCaches(
  qc: QueryClient,
  id: string,
  status: StatusCategoryInput,
  nowIso: string,
) {
  const before = findCachedTask(qc, id);
  patchTaskInCaches(qc, id, statusPatch(status, nowIso));
  if (!before?.parentId || before.statusCategory === status) return;
  const delta = (status === "DONE" ? 1 : 0) - (before.statusCategory === "DONE" ? 1 : 0);
  const parentId = before.parentId;
  updateEverywhere(qc, (other) =>
    other.id === parentId ? adjustSubtaskCount(other, 0, delta) : other,
  );
}

/** Removes a task (deleted, or an undone create) and adjusts its parent's subtask counter. */
export function removeTaskFromCaches(
  qc: QueryClient,
  task: Pick<TaskDTO, "id" | "parentId"> & { statusCategory?: StatusCategoryInput },
) {
  const done = (task.statusCategory ?? findCachedTask(qc, task.id)?.statusCategory) === "DONE";
  qc.removeQueries({ queryKey: queryKeys.tasks.detail(task.id) });
  updateEverywhere(
    qc,
    (other) => (other.id === task.parentId ? adjustSubtaskCount(other, -1, done ? -1 : 0) : other),
    (other) => other.id === task.id,
  );
}

/** The cached copy of a task, wherever it is (lists, details and their subtasks, boards). */
export function findCachedTask(qc: QueryClient, id: string): TaskDTO | undefined {
  for (const [, page] of qc.getQueriesData<TaskPage>({ queryKey: queryKeys.tasks.lists })) {
    const found = page?.items.find((task) => task.id === id);
    if (found) return found;
  }
  for (const [, detail] of qc.getQueriesData<TaskDetailDTO>({
    queryKey: queryKeys.tasks.details,
  })) {
    if (detail?.id === id) return detail;
    const found = detail?.subtasks.find((task) => task.id === id);
    if (found) return found;
  }
  for (const [, board] of qc.getQueriesData<BoardDTO>({ queryKey: queryKeys.boards.all })) {
    const found = board?.columns.flatMap((column) => column.tasks).find((task) => task.id === id);
    if (found) return found;
  }
  return undefined;
}

function adjustSubtaskCount<T extends TaskDTO>(task: T, total: number, done: number): T {
  return {
    ...task,
    subtaskCount: {
      total: Math.max(0, task.subtaskCount.total + total),
      done: Math.max(0, task.subtaskCount.done + done),
    },
  };
}

/** Where a new task lands, mirroring createTask on the server (BR-07, BR-27). */
export type TaskTarget =
  | { kind: "inbox" }
  | { kind: "project"; projectId: string; boardId: string | null }
  | { kind: "subtask"; parentId: string };

export function insertTaskInCaches(qc: QueryClient, task: TaskDTO, target: TaskTarget) {
  if (target.kind === "inbox") {
    qc.setQueryData<TaskPage>(queryKeys.tasks.list({ inbox: true }), (page) =>
      page ? { ...page, items: [...page.items, task] } : page,
    );
  } else if (target.kind === "project" && target.boardId) {
    qc.setQueryData<BoardDTO>(queryKeys.boards.detail(target.boardId), (board) => {
      const first = board?.columns.find((column) => column.statusCategory === "TODO");
      if (!board || !first) return board;
      const landed = { ...task, columnId: first.id };
      return {
        ...board,
        columns: board.columns.map((column) =>
          column.id === first.id ? { ...column, tasks: [...column.tasks, landed] } : column,
        ),
      };
    });
  } else if (target.kind === "subtask") {
    qc.setQueryData<TaskDetailDTO>(queryKeys.tasks.detail(target.parentId), (parent) =>
      parent
        ? { ...adjustSubtaskCount(parent, 1, 0), subtasks: [...parent.subtasks, task] }
        : parent,
    );
  }
}

/** Swaps the optimistic row for the server's DTO once the create succeeds. */
export function replaceTaskInCaches(qc: QueryClient, tempId: string, task: TaskDTO) {
  updateEverywhere(qc, (other) => (other.id === tempId ? task : other));
}

/** Moves a task to the end of `columnId` on its board (TaskDialog column select). */
export function moveTaskInBoard(
  qc: QueryClient,
  boardId: string,
  taskId: string,
  column: { id: string; statusCategory: StatusCategoryInput },
) {
  qc.setQueryData<BoardDTO>(queryKeys.boards.detail(boardId), (board) => {
    const moving = board?.columns.flatMap((c) => c.tasks).find((task) => task.id === taskId);
    if (!board || !moving) return board;
    const moved = { ...moving, columnId: column.id, statusCategory: column.statusCategory };
    return {
      ...board,
      columns: board.columns.map((c) => {
        const tasks = c.tasks.filter((task) => task.id !== taskId);
        return { ...c, tasks: c.id === column.id ? [...tasks, moved] : tasks };
      }),
    };
  });
}

/** A placeholder TaskDTO for an optimistic create. */
export function draftTask(id: string, title: string, fields: Partial<TaskDTO>, nowIso: string) {
  const task: TaskDTO = {
    id,
    title,
    description: null,
    statusCategory: "TODO",
    priority: "MEDIUM",
    startAt: null,
    dueAt: null,
    dueAllDay: true,
    estimate: null,
    isMilestone: false,
    completedAt: null,
    projectId: null,
    courseId: null,
    columnId: null,
    sprintId: null,
    parentId: null,
    order: "",
    labels: [],
    subtaskCount: { total: 0, done: 0 },
    isOverdue: false,
    updatedAt: nowIso,
    ...fields,
  };
  return task;
}
