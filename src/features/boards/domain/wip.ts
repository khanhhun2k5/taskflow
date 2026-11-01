// WIP limits, docs/02 BR-28…BR-30. Pure function: no Prisma, React or Next.

export type WipColumn = {
  wipLimit: number | null; // null = no limit (BR-28)
  wipStrict: boolean;
};

export type WipTask = {
  id: string;
  parentId: string | null;
  deleted: boolean;
};

export type WipCheck = {
  /** false only when a strict column would go over its limit (BR-30). */
  allowed: boolean;
  /** true when the column is over its limit after the move (BR-29). */
  warning: boolean;
};

/** BR-28: only non-deleted parent tasks count toward WIP; subtasks never do (TC-23). */
export function wipCount(columnTasks: WipTask[]): number {
  return columnTasks.filter((task) => task.parentId === null && !task.deleted).length;
}

/**
 * Checks whether `moving` may be placed in a column that currently holds `columnTasks`.
 * Moves inside the same column are always allowed (BR-30), and so are subtasks, since they
 * do not change the count.
 */
export function checkWip(column: WipColumn, columnTasks: WipTask[], moving: WipTask): WipCheck {
  const current = wipCount(columnTasks);
  if (column.wipLimit === null) return { allowed: true, warning: false };

  const alreadyInColumn = columnTasks.some((task) => task.id === moving.id && !task.deleted);
  const addsToCount = moving.parentId === null && !alreadyInColumn;
  const after = addsToCount ? current + 1 : current;
  const over = after > column.wipLimit;

  if (!addsToCount) return { allowed: true, warning: over };
  return { allowed: !(over && column.wipStrict), warning: over };
}

/**
 * Batch version of checkWip for bulk moves and column deletion: `moving` tasks are added to
 * the column at once. Tasks already in the column and subtasks do not change the count.
 */
export function checkWipMany(
  column: WipColumn,
  columnTasks: WipTask[],
  moving: WipTask[],
): WipCheck {
  if (column.wipLimit === null) return { allowed: true, warning: false };

  const inColumn = new Set(columnTasks.filter((task) => !task.deleted).map((task) => task.id));
  const added = new Set(
    moving
      .filter((task) => task.parentId === null && !task.deleted && !inColumn.has(task.id))
      .map((task) => task.id),
  ).size;
  const after = wipCount(columnTasks) + added;
  const over = after > column.wipLimit;

  if (added === 0) return { allowed: true, warning: over };
  return { allowed: !(over && column.wipStrict), warning: over };
}
