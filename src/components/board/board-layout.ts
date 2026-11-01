import { MeasuringStrategy } from "@dnd-kit/core";
import type { ColumnOrder } from "@/features/boards/domain/drop";
import type { BoardDTO } from "@/features/boards/schemas";

// Mouse after 5 px, touch after a 200 ms press, keyboard: Space picks up and drops, arrows
// move, Esc cancels (Enter stays "open TaskDialog"). docs/06 section 4.4, NFR-20.
export const KEYBOARD_CODES = { start: ["Space"], cancel: ["Escape"], end: ["Space"] };

// Droppables are measured before a drag starts, so an arrow key pressed right after Space
// already knows where the next column is (otherwise the first move can be lost).
export const MEASURING = { droppable: { strategy: MeasuringStrategy.BeforeDragging } };

/** Lays out the board's tasks in `order` (the drag draft or the shown board). */
export function arrange(board: BoardDTO, order: ColumnOrder[]): BoardDTO {
  const tasks = new Map(board.columns.flatMap((c) => c.tasks.map((task) => [task.id, task])));
  return {
    ...board,
    columns: board.columns.map((column) => {
      const ids = order.find((c) => c.id === column.id)?.taskIds ?? [];
      return {
        ...column,
        tasks: ids.flatMap((id) => {
          const task = tasks.get(id);
          return task
            ? [{ ...task, columnId: column.id, statusCategory: column.statusCategory }]
            : [];
        }),
      };
    }),
  };
}
