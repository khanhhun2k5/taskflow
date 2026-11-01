"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { z } from "zod";
import type { BoardMove } from "@/features/boards/apply-move";
import { useOptimisticMutation } from "@/features/optimistic";
import { isTempId, queryKeys, tempId } from "@/features/query-keys";
import { apiFetch } from "@/lib/api-client";
import {
  draftTask,
  insertTaskInCaches,
  moveTaskInCaches,
  patchTaskInCaches,
  removeTaskFromCaches,
  replaceTaskInCaches,
  setStatusInCaches,
  type TaskTarget,
} from "./cache";
import type {
  createTaskSchema,
  StatusCategoryInput,
  TaskDetailDTO,
  TaskDTO,
  UpdateTaskInput,
  WithWarnings,
} from "./schemas";

// TanStack Query hooks for single tasks (docs/05 section 2.2). Lists: list-hooks.ts; trash:
// trash-hooks.ts. Components call the API only through these hooks (docs/03 section 3).

type CreateTaskBody = z.input<typeof createTaskSchema>;

const nowIso = () => new Date().toISOString();

/** Shared by every task write: lists, details, boards; progress and trash are derived. */
export const TASK_CACHES = [queryKeys.tasks.all, queryKeys.boards.all] as const;
export const DERIVED = [queryKeys.projects.all, queryKeys.trash.all] as const;

/** Mutation keys (after OPTIMISTIC_KEY) used to watch writes in flight. */
export const TASK_UPDATE_KEY = ["task-update"] as const;
export const MOVE_KEY = ["move"] as const;

/** BR-29: warning-mode WIP limits still save but tell the user. */
export function useWipWarning() {
  const t = useTranslations("Warnings");
  return (result: { warnings: string[] }) => {
    if (result.warnings.includes("WIP_LIMIT_EXCEEDED")) toast.warning(t("WIP_LIMIT_EXCEEDED"));
  };
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(id ?? ""),
    queryFn: ({ signal }) => apiFetch<TaskDetailDTO>(`/tasks/${id}`, { signal }),
    enabled: id !== null && !isTempId(id),
  });
}

function createContext(target: TaskTarget): Partial<CreateTaskBody> {
  if (target.kind === "subtask") return { parentId: target.parentId };
  if (target.kind === "project") {
    return target.columnId ? { columnId: target.columnId } : { projectId: target.projectId };
  }
  return {};
}

/** Creates a task in the page's context (docs/06 section 4.1); `columnId` targets a column. */
export function useCreateTask(target: TaskTarget) {
  const warn = useWipWarning();
  const context = createContext(target);
  const fields: Partial<TaskDTO> =
    target.kind === "project"
      ? { projectId: target.projectId }
      : target.kind === "subtask"
        ? { parentId: target.parentId }
        : {};

  const mutation = useOptimisticMutation({
    mutationFn: ({ title }: { title: string; id: string }) =>
      apiFetch<WithWarnings<TaskDTO>>("/tasks", { method: "POST", body: { title, ...context } }),
    affects: TASK_CACHES,
    invalidate: DERIVED,
    apply: (qc, { title, id }) =>
      insertTaskInCaches(qc, draftTask(id, title, fields, nowIso()), target),
    rollback: (qc, { id }) =>
      removeTaskFromCaches(qc, {
        id,
        parentId: target.kind === "subtask" ? target.parentId : null,
      }),
    onSuccess: (qc, { warnings, ...task }, { id }) => {
      replaceTaskInCaches(qc, id, task);
      warn({ warnings });
    },
  });
  return { ...mutation, create: (title: string) => mutation.mutate({ title, id: tempId() }) };
}

export type TaskUpdate = {
  id: string;
  input: UpdateTaskInput;
  /** What the cache shows meanwhile (e.g. label objects for `labelIds`). */
  optimistic: Partial<TaskDTO>;
};

export function useUpdateTask() {
  return useOptimisticMutation({
    key: TASK_UPDATE_KEY,
    // useTaskSaver reads these to show "Saved"; keep them while a dialog may be open.
    gcTime: Infinity,
    mutationFn: ({ id, input }: TaskUpdate) =>
      apiFetch<WithWarnings<TaskDTO>>(`/tasks/${id}`, { method: "PATCH", body: input }),
    affects: TASK_CACHES,
    invalidate: DERIVED,
    apply: (qc, { id, optimistic }) => patchTaskInCaches(qc, id, optimistic),
  });
}

/** Checkbox status for tasks without a column (inbox tasks, subtasks; BR-02). */
export function useSetTaskStatus() {
  return useOptimisticMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusCategoryInput }) =>
      apiFetch<TaskDTO>(`/tasks/${id}`, { method: "PATCH", body: { statusCategory: status } }),
    affects: TASK_CACHES,
    invalidate: DERIVED,
    apply: (qc, { id, status }) => setStatusInCaches(qc, id, status, nowIso()),
  });
}

/**
 * POST /tasks/:id/move (drop on the board, column select in TaskDialog). Moves in flight
 * are watched by the board (MOVE_KEY) and re-applied over refetched data until they settle.
 * WIP strict (409) rolls back with the localized toast; warning mode toasts a warning.
 */
export function useMoveTask() {
  const warn = useWipWarning();
  return useOptimisticMutation({
    key: MOVE_KEY,
    mutationFn: ({ id, target, beforeId, afterId }: BoardMove) =>
      apiFetch<WithWarnings<TaskDTO>>(`/tasks/${id}/move`, {
        method: "POST",
        body: { columnId: target.columnId, beforeId, afterId },
      }),
    affects: TASK_CACHES,
    invalidate: DERIVED,
    // NFR-03: the answer is the moved TaskDTO; write it into the board and lists instead of
    // refetching a 500-task board. Only derived progress is refetched.
    successInvalidate: [queryKeys.projects.all],
    apply: (qc, move) => moveTaskInCaches(qc, move, move.statusCategory),
    onSuccess: (qc, { warnings, ...task }, move) => {
      // Re-apply the confirmed move: the cache may hold data fetched while /move was in
      // flight (shown correctly only thanks to the pending-move overlay, now gone).
      moveTaskInCaches(qc, move, task.statusCategory);
      patchTaskInCaches(qc, task.id, task);
      warn({ warnings });
    },
  });
}

export function useDeleteTask() {
  const t = useTranslations("TaskDialog");
  return useOptimisticMutation({
    mutationFn: ({ id }: Pick<TaskDTO, "id" | "parentId">) =>
      apiFetch<void>(`/tasks/${id}`, { method: "DELETE" }),
    affects: TASK_CACHES,
    invalidate: DERIVED,
    apply: (qc, task) => removeTaskFromCaches(qc, task),
    onSuccess: () => toast.success(t("deleted")),
  });
}
