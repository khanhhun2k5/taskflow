"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { z } from "zod";
import { useOptimisticMutation } from "@/features/optimistic";
import { isTempId, LIST_LIMIT, queryKeys, tempId } from "@/features/query-keys";
import { apiFetch, toQuery } from "@/lib/api-client";
import type { Page } from "@/lib/pagination";
import {
  draftTask,
  insertTaskInCaches,
  moveTaskInBoard,
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
  TrashItemDTO,
  UpdateTaskInput,
  WithWarnings,
} from "./schemas";

// TanStack Query hooks for tasks and the trash (docs/05 section 2.2). Components call the
// API only through these hooks (docs/03 section 3).

type CreateTaskBody = z.input<typeof createTaskSchema>;

const nowIso = () => new Date().toISOString();

/** Shared by every task write: lists, details, boards; progress and trash are derived. */
const TASK_CACHES = [queryKeys.tasks.all, queryKeys.boards.all] as const;
const DERIVED = [queryKeys.projects.all, queryKeys.trash.all] as const;

/** BR-29: warning-mode WIP limits still save but tell the user. */
function useWipWarning() {
  const t = useTranslations("Warnings");
  return (result: { warnings: string[] }) => {
    if (result.warnings.includes("WIP_LIMIT_EXCEEDED")) toast.warning(t("WIP_LIMIT_EXCEEDED"));
  };
}

export function useInboxTasks() {
  return useQuery({
    queryKey: queryKeys.tasks.list({ inbox: true }),
    queryFn: ({ signal }) =>
      apiFetch<Page<TaskDTO>>(`/tasks${toQuery({ inbox: true, limit: LIST_LIMIT })}`, { signal }),
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(id ?? ""),
    queryFn: ({ signal }) => apiFetch<TaskDetailDTO>(`/tasks/${id}`, { signal }),
    enabled: id !== null && !isTempId(id),
  });
}

/** Creates a task in the page's context (docs/06 section 4.1). */
export function useCreateTask(target: TaskTarget) {
  const warn = useWipWarning();
  const context: Partial<CreateTaskBody> =
    target.kind === "project"
      ? { projectId: target.projectId }
      : target.kind === "subtask"
        ? { parentId: target.parentId }
        : {};
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

type MoveVars = {
  id: string;
  boardId: string;
  column: { id: string; statusCategory: StatusCategoryInput };
};

/** Column select in TaskDialog: moves to the end of the column (docs/05 POST /move). */
export function useMoveTask() {
  const warn = useWipWarning();
  return useOptimisticMutation({
    mutationFn: ({ id, column }: MoveVars) =>
      apiFetch<WithWarnings<TaskDTO>>(`/tasks/${id}/move`, {
        method: "POST",
        body: { columnId: column.id, beforeId: null, afterId: null },
      }),
    affects: TASK_CACHES,
    invalidate: DERIVED,
    apply: (qc, { id, boardId, column }) => {
      moveTaskInBoard(qc, boardId, id, column);
      patchTaskInCaches(qc, id, { columnId: column.id, statusCategory: column.statusCategory });
    },
    onSuccess: (_qc, result) => warn(result),
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

export function useTrash() {
  return useQuery({
    queryKey: queryKeys.trash.all,
    queryFn: ({ signal }) =>
      apiFetch<Page<TrashItemDTO>>(`/trash${toQuery({ limit: LIST_LIMIT })}`, { signal }),
  });
}

/** Restores a task or a project from the trash (BR-10, US-13). */
export function useRestore() {
  const t = useTranslations("Trash");
  // Hook-level onSuccess: the trash row unmounts as soon as it is removed optimistically.
  return useOptimisticMutation({
    mutationFn: ({ type, id }: Pick<TrashItemDTO, "type" | "id" | "title">) =>
      apiFetch<unknown>(`/${type === "task" ? "tasks" : "projects"}/${id}/restore`, {
        method: "POST",
      }),
    affects: [queryKeys.trash.all],
    invalidate: [...TASK_CACHES, queryKeys.projects.all],
    apply: (qc, { id }) =>
      qc.setQueryData<Page<TrashItemDTO>>(queryKeys.trash.all, (page) =>
        page ? { ...page, items: page.items.filter((item) => item.id !== id) } : page,
      ),
    onSuccess: (_qc, _data, { title }) => toast.success(t("restored", { title })),
  });
}
