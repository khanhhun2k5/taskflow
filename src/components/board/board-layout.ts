import type { ColumnOrder } from "@/features/boards/domain/drop";
import type { BoardDTO } from "@/features/boards/schemas";

// Mouse after 5 px, touch after a 200 ms press, keyboard: Space picks up and drops, arrows
// move, Esc cancels (Enter stays "open TaskDialog"). docs/06 section 4.4, NFR-20.
export const KEYBOARD_CODES = { start: ["Space"], cancel: ["Escape"], end: ["Space"] };

/** Light column summary for menus (stable while names, statuses and order stay the same). */
export type ColumnMeta = { id: string; name: string };

/**
 * Lays out the board's tasks in `order` (the drag draft or the shown board). NFR-03: object
 * identity is kept for every column and task that did not change, so memoized columns and
 * cards skip rendering; only the columns a card left or entered (and that card) are new.
 */
export function arrange(board: BoardDTO, order: ColumnOrder[]): BoardDTO {
  const tasks = new Map(board.columns.flatMap((c) => c.tasks.map((task) => [task.id, task])));
  let changed = false;
  const columns = board.columns.map((column) => {
    const ids = order.find((c) => c.id === column.id)?.taskIds ?? [];
    const same =
      ids.length === column.tasks.length && ids.every((id, i) => column.tasks[i].id === id);
    if (same) return column;
    changed = true;
    return {
      ...column,
      tasks: ids.flatMap((id) => {
        const task = tasks.get(id);
        if (!task) return [];
        return task.columnId === column.id && task.statusCategory === column.statusCategory
          ? [task]
          : [{ ...task, columnId: column.id, statusCategory: column.statusCategory }];
      }),
    };
  });
  return changed ? { ...board, columns } : board;
}
