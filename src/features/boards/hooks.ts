"use client";

import { useMutationState, useQuery, type QueryClient } from "@tanstack/react-query";
import { useOptimisticMutation, OPTIMISTIC_KEY } from "@/features/optimistic";
import { queryKeys, tempId } from "@/features/query-keys";
import { DERIVED, MOVE_KEY, TASK_CACHES, useWipWarning } from "@/features/tasks/hooks";
import type { Warning } from "@/features/tasks/schemas";
import { apiFetch, toQuery } from "@/lib/api-client";
import { applyMove, type BoardMove } from "./apply-move";
import type { BoardDTO, ColumnDTO, CreateColumnInput, UpdateColumnInput } from "./schemas";

// Board and column hooks (docs/05 section 2.3).

/** GET /boards/:id — columns with their top-level tasks. */
export function useBoard(
  boardId: string | null,
  options: { refetchOnWindowFocus?: boolean | (() => boolean) } = {},
) {
  return useQuery({
    queryKey: queryKeys.boards.detail(boardId ?? ""),
    queryFn: ({ signal }) => apiFetch<BoardDTO>(`/boards/${boardId}`, { signal }),
    enabled: boardId !== null,
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? true,
  });
}

/** /move requests of this board still waiting for the server, oldest first. */
export function usePendingMoves(boardId: string): BoardMove[] {
  return useMutationState({
    filters: {
      mutationKey: [...OPTIMISTIC_KEY, ...MOVE_KEY],
      status: "pending",
      predicate: (mutation) =>
        (mutation.state.variables as BoardMove | undefined)?.boardId === boardId,
    },
    select: (mutation) => mutation.state.variables as BoardMove,
  });
}

/**
 * The board as shown: server data with moves still in flight re-applied on top, so a refetch
 * (window focus, invalidation) that returns pre-move data cannot make a dropped card jump.
 */
export function withPendingMoves(board: BoardDTO, moves: BoardMove[]): BoardDTO {
  return moves.reduce((current, move) => applyMove(current, move), board);
}

const COLUMN_CACHES = [queryKeys.boards.all, queryKeys.tasks.all] as const;

function editBoard(qc: QueryClient, boardId: string, edit: (board: BoardDTO) => BoardDTO) {
  qc.setQueryData<BoardDTO>(queryKeys.boards.detail(boardId), (board) => board && edit(board));
}

/** Index of the new column from its neighbours (beforeId = column on the left). */
function insertIndex(columns: ColumnDTO[], beforeId?: string | null, afterId?: string | null) {
  const left = columns.findIndex((c) => c.id === beforeId);
  if (left !== -1) return left + 1;
  const right = columns.findIndex((c) => c.id === afterId);
  return right !== -1 ? right : columns.length;
}

export function useCreateColumn(boardId: string) {
  return useOptimisticMutation({
    mutationFn: ({ input }: { id: string; input: CreateColumnInput }) =>
      apiFetch<ColumnDTO>(`/boards/${boardId}/columns`, { method: "POST", body: input }),
    affects: COLUMN_CACHES,
    apply: (qc, { id, input }) =>
      editBoard(qc, boardId, (board) => {
        const columns = [...board.columns];
        const column = {
          id,
          name: input.name,
          statusCategory: input.statusCategory,
          order: "",
          wipLimit: input.wipLimit ?? null,
          wipStrict: input.wipStrict ?? false,
          tasks: [],
        };
        columns.splice(insertIndex(columns, input.beforeId, input.afterId), 0, column);
        return { ...board, columns };
      }),
    // Swap the temp id for the real one at once: the column's menu, QuickAdd and drop zone
    // stay locked while it is temporary (a temp id sent to the API is a 404).
    onSuccess: (qc, created, { id }) =>
      editBoard(qc, boardId, (board) => ({
        ...board,
        columns: board.columns.map((c) => (c.id === id ? { ...c, ...created } : c)),
      })),
  });
}

export function useCreateColumnAction(boardId: string) {
  const mutation = useCreateColumn(boardId);
  return (input: CreateColumnInput) => mutation.mutate({ id: tempId(), input });
}

/** PATCH /columns/:id — a status change also moves every task's status (ADR-03). */
export function useUpdateColumn(boardId: string) {
  return useOptimisticMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateColumnInput }) =>
      apiFetch<ColumnDTO>(`/columns/${id}`, { method: "PATCH", body: input }),
    affects: COLUMN_CACHES,
    invalidate: DERIVED,
    apply: (qc, { id, input }) =>
      editBoard(qc, boardId, (board) => ({
        ...board,
        columns: board.columns.map((c) =>
          c.id !== id
            ? c
            : {
                ...c,
                ...input,
                tasks: input.statusCategory
                  ? c.tasks.map((t) => ({
                      ...t,
                      statusCategory: input.statusCategory ?? t.statusCategory,
                    }))
                  : c.tasks,
              },
        ),
      })),
  });
}

/** POST /columns/:id/move — `index` is the new position among the other columns. */
export function useMoveColumn(boardId: string) {
  return useOptimisticMutation({
    mutationFn: ({
      id,
      beforeId,
      afterId,
    }: {
      id: string;
      index: number;
      beforeId: string | null;
      afterId: string | null;
    }) =>
      apiFetch<ColumnDTO>(`/columns/${id}/move`, { method: "POST", body: { beforeId, afterId } }),
    affects: [queryKeys.boards.all],
    apply: (qc, { id, index }) =>
      editBoard(qc, boardId, (board) => {
        const moving = board.columns.find((c) => c.id === id);
        if (!moving) return board;
        const rest = board.columns.filter((c) => c.id !== id);
        rest.splice(index, 0, moving);
        return { ...board, columns: rest };
      }),
  });
}

/** DELETE /columns/:id?moveTo= — tasks go to `moveTo` (BR-26) and take its status (BR-01). */
export function useDeleteColumn(boardId: string) {
  const warn = useWipWarning();
  return useOptimisticMutation({
    mutationFn: ({ id, moveTo }: { id: string; moveTo?: string }) =>
      apiFetch<{ warnings: Warning[] }>(`/columns/${id}${toQuery({ moveTo })}`, {
        method: "DELETE",
      }),
    affects: [...COLUMN_CACHES, ...TASK_CACHES],
    invalidate: DERIVED,
    apply: (qc, { id, moveTo }) =>
      editBoard(qc, boardId, (board) => {
        const removed = board.columns.find((c) => c.id === id);
        return {
          ...board,
          columns: board.columns
            .filter((c) => c.id !== id)
            .map((c) =>
              c.id === moveTo && removed
                ? {
                    ...c,
                    tasks: [
                      ...c.tasks,
                      ...removed.tasks.map((t) => ({
                        ...t,
                        columnId: c.id,
                        statusCategory: c.statusCategory,
                      })),
                    ],
                  }
                : c,
            ),
        };
      }),
    onSuccess: (_qc, result) => warn(result),
  });
}
