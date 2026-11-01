"use client";

import {
  useCreateColumnAction,
  useDeleteColumn,
  useMoveColumn,
  useUpdateColumn,
} from "@/features/boards/hooks";
import type { BoardDTO } from "@/features/boards/schemas";
import type { ColumnActions } from "./column-header";

/** Menu actions of one column, wired to the column mutations (US-16, BR-25…28). */
export function useColumnActions(board: BoardDTO) {
  const create = useCreateColumnAction(board.id);
  const update = useUpdateColumn(board.id);
  const move = useMoveColumn(board.id);
  const remove = useDeleteColumn(board.id);

  return (columnId: string): ColumnActions => {
    const index = board.columns.findIndex((c) => c.id === columnId);
    const left = board.columns[index - 1];
    const right = board.columns[index + 1];
    return {
      update: (input) => update.mutate({ id: columnId, input }),
      // beforeId = the column on the left of the new one, afterId = the one on its right.
      add: (side, values) =>
        create({
          name: values.name,
          statusCategory: values.statusCategory,
          ...(side === "left"
            ? { beforeId: left?.id ?? null, afterId: columnId }
            : { beforeId: columnId, afterId: right?.id ?? null }),
        }),
      move: (direction) => {
        const others = board.columns.filter((c) => c.id !== columnId);
        const target = index + direction;
        if (target < 0 || target > others.length) return;
        move.mutate({
          id: columnId,
          index: target,
          beforeId: others[target - 1]?.id ?? null,
          afterId: others[target]?.id ?? null,
        });
      },
      remove: (moveTo) => remove.mutate({ id: columnId, moveTo }),
    };
  };
}
