import type { StatusCategoryInput } from "@/features/tasks/schemas";
import { moveInColumns, type DropTarget } from "./domain/drop";
import type { BoardDTO } from "./schemas";

/** A pending or optimistic card move on a board (also the /move mutation's variables). */
export type BoardMove = {
  id: string;
  boardId: string;
  target: DropTarget;
  /** Status of the target column (BR-01), shown before the server confirms. */
  statusCategory: StatusCategoryInput;
  beforeId: string | null;
  afterId: string | null;
};

/**
 * `board` with the card moved to `move.target`. Used for the optimistic cache update and to
 * re-apply moves still in flight over whatever the server last returned, so a refetch with
 * old data cannot make a dropped card jump back (docs/06 section 1.3).
 */
export function applyMove(
  board: BoardDTO,
  move: Pick<BoardMove, "id" | "target" | "statusCategory">,
) {
  const tasks = new Map(board.columns.flatMap((column) => column.tasks.map((t) => [t.id, t])));
  const moving = tasks.get(move.id);
  if (!moving) return board;
  tasks.set(move.id, {
    ...moving,
    columnId: move.target.columnId,
    statusCategory: move.statusCategory,
  });
  const order = moveInColumns(
    board.columns.map((column) => ({ id: column.id, taskIds: column.tasks.map((t) => t.id) })),
    move.id,
    move.target,
  );
  return {
    ...board,
    columns: board.columns.map((column, index) => ({
      ...column,
      tasks: order[index].taskIds.flatMap((id) => {
        const task = tasks.get(id);
        return task ? [task] : [];
      }),
    })),
  };
}
