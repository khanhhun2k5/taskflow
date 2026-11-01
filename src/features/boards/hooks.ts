"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/features/query-keys";
import { apiFetch } from "@/lib/api-client";
import type { BoardDTO } from "./schemas";

/** GET /boards/:id — columns with their top-level tasks (docs/05 section 2.3). */
export function useBoard(boardId: string | null) {
  return useQuery({
    queryKey: queryKeys.boards.detail(boardId ?? ""),
    queryFn: ({ signal }) => apiFetch<BoardDTO>(`/boards/${boardId}`, { signal }),
    enabled: boardId !== null,
  });
}
