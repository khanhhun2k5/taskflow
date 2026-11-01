"use client";

import { useInfiniteQuery, type QueryClient } from "@tanstack/react-query";
import { useTimeZone, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { LabelDTO } from "@/features/labels/schemas";
import { nextCursor } from "@/features/infinite";
import { useOptimisticMutation } from "@/features/optimistic";
import { PAGE_SIZE, queryKeys, type TaskListParams, type TaskScope } from "@/features/query-keys";
import { apiFetch, toQuery } from "@/lib/api-client";
import type { Page } from "@/lib/pagination";
import {
  findCachedTask,
  patchTaskInCaches,
  removeTaskFromCaches,
  setStatusInCaches,
} from "./cache";
import { DERIVED, TASK_CACHES, useWipWarning } from "./hooks";
import { toListQuery } from "./list-params";
import { BULK_MAX, type BulkAction, type TaskDTO, type Warning } from "./schemas";

/** ListView rows: GET /tasks with filters from the URL, loaded page by page (nextCursor). */
export function useTaskList(scope: TaskScope, params: TaskListParams) {
  const tz = useTimeZone() ?? "UTC";
  return useInfiniteQuery({
    queryKey: queryKeys.tasks.list(scope, params),
    initialPageParam: null as string | null,
    getNextPageParam: nextCursor,
    queryFn: ({ signal, pageParam }) =>
      apiFetch<Page<TaskDTO>>(
        `/tasks${toQuery({
          ...toListQuery(scope, params, tz),
          limit: PAGE_SIZE,
          cursor: pageParam ?? undefined,
        })}`,
        { signal },
      ),
  });
}

/** Bulk action plus what the cache needs to show it before the server answers. */
export type BulkVars = {
  ids: string[];
  action: BulkAction;
  /** Label objects for addLabel; target column status for move. */
  label?: LabelDTO;
  columnStatus?: TaskDTO["statusCategory"];
};

function applyBulk(qc: QueryClient, { ids, action, label, columnStatus }: BulkVars) {
  const now = new Date().toISOString();
  for (const id of ids) {
    const task = findCachedTask(qc, id);
    switch (action.type) {
      case "setPriority":
        patchTaskInCaches(qc, id, { priority: action.priority });
        break;
      case "setStatus":
        setStatusInCaches(qc, id, action.status, now);
        break;
      case "setDue":
        patchTaskInCaches(qc, id, { dueAt: action.dueAt, isOverdue: false });
        break;
      case "addLabel":
        if (task && label && !task.labels.some((l) => l.id === label.id)) {
          const labels = [...task.labels, label].sort((a, b) => a.name.localeCompare(b.name));
          patchTaskInCaches(qc, id, { labels });
        }
        break;
      case "removeLabel":
        if (task) {
          patchTaskInCaches(qc, id, { labels: task.labels.filter((l) => l.id !== action.labelId) });
        }
        break;
      case "move":
        if (columnStatus) {
          patchTaskInCaches(qc, id, { columnId: action.columnId, statusCategory: columnStatus });
        }
        break;
      case "delete":
        removeTaskFromCaches(qc, { id, parentId: task?.parentId ?? null });
        break;
    }
  }
}

/** POST /tasks/bulk (BR-31): all or nothing, at most BULK_MAX tasks. */
export function useBulkUpdate(onDone?: () => void) {
  const t = useTranslations("Bulk");
  const warn = useWipWarning();
  return useOptimisticMutation({
    mutationFn: ({ ids, action }: BulkVars) =>
      apiFetch<{ updated: number; warnings: Warning[] }>("/tasks/bulk", {
        method: "POST",
        body: { ids: ids.slice(0, BULK_MAX), action },
      }),
    affects: TASK_CACHES,
    invalidate: DERIVED,
    apply: applyBulk,
    onSuccess: (_qc, result) => {
      warn(result);
      toast.success(t("done", { count: result.updated }));
      onDone?.();
    },
  });
}
