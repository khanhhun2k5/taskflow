import type { Prisma } from "@/generated/prisma/client";
import { keyAtIndex, keysForAppend } from "@/lib/ordering";
import { invalidInput, type Db, type Tx } from "./task-dto";

// Order keys for tasks (ADR-05, BR-13). Lists are always read ORDER BY "order", id so that
// equal keys still give a stable order.

export const stableOrder = [{ order: "asc" }, { id: "asc" }] as const satisfies
  Prisma.TaskOrderByWithRelationInput[] | Prisma.ColumnOrderByWithRelationInput[];

type Ordered = { id: string; order: string };

/**
 * Index where an item lands, from the ids of its new neighbours (docs/05 POST /tasks/:id/move).
 * The server finds the real neighbour from `beforeId` (or `afterId`) itself, so a client
 * with a stale list cannot produce duplicate keys. Both null means "append".
 */
export function insertionIndex(
  list: Ordered[],
  beforeId: string | null | undefined,
  afterId: string | null | undefined,
): number {
  if (beforeId) {
    const index = list.findIndex((item) => item.id === beforeId);
    if (index === -1) throw invalidInput("beforeId", "Not in the target list");
    return index + 1;
  }
  if (afterId) {
    const index = list.findIndex((item) => item.id === afterId);
    if (index === -1) throw invalidInput("afterId", "Not in the target list");
    return index;
  }
  return list.length;
}

/** New task key at `index` of `list`; re-keys the list in the same transaction if needed. */
export async function taskKeyAt(tx: Tx, list: Ordered[], index: number): Promise<string> {
  const { key, rekeyed } = keyAtIndex(
    list.map((item) => item.order),
    index,
  );
  if (rekeyed) {
    for (const [i, item] of list.entries()) {
      await tx.task.update({ where: { id: item.id }, data: { order: rekeyed[i] } });
    }
  }
  return key;
}

/**
 * `n` keys after the last task matching `where`. Deleted tasks are included so appends never
 * reuse their keys; a rare re-key (taskKeyAt) only renumbers live tasks, and any remaining tie
 * with a deleted task is harmless because lists are always ordered by (order, id).
 */
export async function appendTaskKeys(db: Db, where: Prisma.TaskWhereInput, n: number) {
  const last = await db.task.findFirst({
    where,
    orderBy: [{ order: "desc" }, { id: "desc" }],
    select: { order: true },
  });
  return keysForAppend(n, last?.order ?? null);
}

/** Visible top-level tasks of a column in board order (the list a drop position refers to). */
export function columnTasksInOrder(db: Db, columnId: string, excludeId?: string) {
  return db.task.findMany({
    where: {
      columnId,
      deletedAt: null,
      parentId: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: [...stableOrder],
    select: { id: true, order: true },
  });
}
