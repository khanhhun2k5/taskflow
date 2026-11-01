import type { ActivityType, Prisma, StatusCategory } from "@/generated/prisma/client";
import type { Tx } from "./task-dto";

// ADR-03: the ONLY place that changes Task.statusCategory. Callers:
//   1. moveTask (tasks.ts) — including relocation and bulk "move", which reuse it,
//   2. updateColumn / deleteColumn (boards.ts),
//   3. setTaskStatus (tasks.ts) — tasks without a column only (BR-02).
// Each change also sets completedAt (BR-03) and appends STATUS_CHANGED (BR-95), in the
// caller's transaction.

export type StatusTask = { id: string; statusCategory: StatusCategory; deletedAt: Date | null };

export type ActivityEntry = {
  taskId: string;
  type: ActivityType;
  fromValue?: Prisma.InputJsonValue;
  toValue?: Prisma.InputJsonValue;
};

/** BR-95 / BR-96: append-only activity log. */
export async function logActivity(
  tx: Tx,
  userId: string,
  entries: ActivityEntry[],
  now: Date,
): Promise<void> {
  if (entries.length === 0) return;
  await tx.activityLog.createMany({
    data: entries.map((entry) => ({ ...entry, userId, at: now })),
  });
}

/**
 * Moves `tasks` to status `to`. Tasks already in `to` are left alone. Soft-deleted tasks are
 * updated too (to keep invariant 1 of docs/04 section 4) but not logged.
 * Returns the ids that changed.
 */
export async function transitionStatus(
  tx: Tx,
  userId: string,
  tasks: StatusTask[],
  to: StatusCategory,
  now: Date,
): Promise<string[]> {
  const changing = tasks.filter((task) => task.statusCategory !== to);
  if (changing.length === 0) return [];

  const ids = changing.map((task) => task.id);
  await tx.task.updateMany({
    where: { id: { in: ids }, userId },
    data: { statusCategory: to, completedAt: to === "DONE" ? now : null }, // BR-03
  });
  await logActivity(
    tx,
    userId,
    changing
      .filter((task) => task.deletedAt === null)
      .map((task) => ({
        taskId: task.id,
        type: "STATUS_CHANGED" as const,
        fromValue: { statusCategory: task.statusCategory },
        toValue: { statusCategory: to },
      })),
    now,
  );
  return ids;
}
