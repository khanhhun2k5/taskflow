"use client";

import { useMemo } from "react";
import {
  useCreateColumn,
  useDeleteColumn,
  useMoveColumn,
  useUpdateColumn,
} from "@/features/boards/hooks";
import { tempId } from "@/features/query-keys";
import type { ColumnMeta } from "./board-layout";
import type { ColumnActions } from "./column-header";

/**
 * Menu actions of one column, wired to the column mutations (US-16, BR-25…28). The object is
 * stable while the column order stays the same, so a memoized column does not re-render.
 */
export function useColumnActions(
  boardId: string,
  columns: ColumnMeta[],
  columnId: string,
): ColumnActions {
  const { mutate: create } = useCreateColumn(boardId);
  const { mutate: update } = useUpdateColumn(boardId);
  const { mutate: move } = useMoveColumn(boardId);
  const { mutate: remove } = useDeleteColumn(boardId);

  return useMemo(() => {
    const index = columns.findIndex((c) => c.id === columnId);
    const left = columns[index - 1];
    const right = columns[index + 1];
    return {
      update: (input) => update({ id: columnId, input }),
      // beforeId = the column on the left of the new one, afterId = the one on its right.
      add: (side, values) =>
        create({
          id: tempId(),
          input: {
            name: values.name,
            statusCategory: values.statusCategory,
            ...(side === "left"
              ? { beforeId: left?.id ?? null, afterId: columnId }
              : { beforeId: columnId, afterId: right?.id ?? null }),
          },
        }),
      move: (direction) => {
        const others = columns.filter((c) => c.id !== columnId);
        const target = index + direction;
        if (target < 0 || target > others.length) return;
        move({
          id: columnId,
          index: target,
          beforeId: others[target - 1]?.id ?? null,
          afterId: others[target]?.id ?? null,
        });
      },
      remove: (moveTo) => remove({ id: columnId, moveTo }),
    };
  }, [columns, columnId, create, update, move, remove]);
}
