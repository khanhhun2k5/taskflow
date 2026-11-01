// Kanban drop logic (docs/06 section 4.4, docs/05 POST /tasks/:id/move). Pure functions:
// no React, no dnd-kit types. Every drop index is an index in the target column's task list
// WITHOUT the dragged task, so "index i" always means "between list[i - 1] and list[i]".

export type ColumnOrder = { id: string; taskIds: string[] };

export type DropTarget = { columnId: string; index: number };

export type DropPlan = { columnId: string; beforeId: string | null; afterId: string | null };

/** Column holding `taskId`, and its index in that column (with the task still in it). */
export function locate(
  columns: ColumnOrder[],
  taskId: string,
): { columnId: string; index: number } | null {
  for (const column of columns) {
    const index = column.taskIds.indexOf(taskId);
    if (index !== -1) return { columnId: column.id, index };
  }
  return null;
}

/**
 * Where a drop "over" something lands. `overId` is a column id (empty space / column body:
 * end of the column) or a task id. Inside the same column dnd-kit's arrayMove semantics
 * apply: the dragged task takes the over task's index. Across columns the task goes before
 * the over task, or after it when `after` is true (pointer below its middle).
 */
export function dropTargetFromOver(
  columns: ColumnOrder[],
  activeId: string,
  overId: string,
  after = false,
): DropTarget | null {
  const overColumn = columns.find((column) => column.id === overId);
  if (overColumn) {
    return {
      columnId: overColumn.id,
      index: overColumn.taskIds.filter((id) => id !== activeId).length,
    };
  }
  const over = locate(columns, overId);
  const active = locate(columns, activeId);
  if (!over || !active) return null;
  if (over.columnId === active.columnId) return { columnId: over.columnId, index: over.index };
  return { columnId: over.columnId, index: over.index + (after ? 1 : 0) };
}

/** Columns after moving `taskId` to `target` (index without the task); unknown task → same. */
export function moveInColumns(
  columns: ColumnOrder[],
  taskId: string,
  target: DropTarget,
): ColumnOrder[] {
  if (!locate(columns, taskId) || !columns.some((column) => column.id === target.columnId)) {
    return columns;
  }
  return columns.map((column) => {
    const rest = column.taskIds.filter((id) => id !== taskId);
    if (column.id !== target.columnId) return { ...column, taskIds: rest };
    const index = Math.max(0, Math.min(target.index, rest.length));
    return { ...column, taskIds: [...rest.slice(0, index), taskId, ...rest.slice(index)] };
  });
}

/**
 * The /move request for a drop, or null when the task would stay where it is (no request).
 * beforeId = the task right above the drop position, afterId = the task right below; the
 * server uses beforeId when present, otherwise afterId; both null = empty column.
 */
export function planDrop(
  columns: ColumnOrder[],
  taskId: string,
  target: DropTarget,
): DropPlan | null {
  const from = locate(columns, taskId);
  const column = columns.find((c) => c.id === target.columnId);
  if (!from || !column) return null;
  const rest = column.taskIds.filter((id) => id !== taskId);
  const index = Math.max(0, Math.min(target.index, rest.length));
  if (from.columnId === target.columnId && from.index === index) return null;
  return {
    columnId: target.columnId,
    beforeId: rest[index - 1] ?? null,
    afterId: rest[index] ?? null,
  };
}
