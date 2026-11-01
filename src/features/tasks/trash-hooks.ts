"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { mapPages, nextCursor, type Pages } from "@/features/infinite";
import { useOptimisticMutation } from "@/features/optimistic";
import { PAGE_SIZE, queryKeys } from "@/features/query-keys";
import { apiFetch, toQuery } from "@/lib/api-client";
import type { Page } from "@/lib/pagination";
import { TASK_CACHES } from "./hooks";
import type { TrashItemDTO } from "./schemas";

/** GET /trash with infinite scroll (docs/05 section 2.2). */
export function useTrash() {
  return useInfiniteQuery({
    queryKey: queryKeys.trash.all,
    initialPageParam: null as string | null,
    getNextPageParam: nextCursor,
    queryFn: ({ signal, pageParam }) =>
      apiFetch<Page<TrashItemDTO>>(
        `/trash${toQuery({ limit: PAGE_SIZE, cursor: pageParam ?? undefined })}`,
        { signal },
      ),
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
      qc.setQueryData<Pages<TrashItemDTO>>(queryKeys.trash.all, (data) =>
        mapPages(data, (items) => items.filter((item) => item.id !== id)),
      ),
    onSuccess: (_qc, _data, { title }) => toast.success(t("restored", { title })),
  });
}
