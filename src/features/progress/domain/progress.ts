import type { StatusCategory } from "@/lib/dates";

// Progress formulas, docs/07-progress-metrics.md sections 1–3 and signatures in section 8.
// Pure functions: no Prisma, React or Next. `estimate` is a plain number here; the service
// layer converts Prisma's Decimal before calling (docs/04).

export type ProgressItem = {
  id: string;
  parentId: string | null;
  statusCategory: StatusCategory;
  estimate: number | null;
  isMilestone: boolean;
  deleted: boolean;
};

export type CountProgress = { done: number; total: number; percent: number };
export type WeightedProgress = CountProgress & { reliable: boolean };

/** Missing estimates count as 1 (docs/07 section 3). */
const DEFAULT_ESTIMATE = 1;

function percentOf(done: number, total: number): number {
  return total > 0 ? (done / total) * 100 : 0;
}

/**
 * The set L of docs/07 section 1: deleted tasks (BR-09) and milestones are dropped, and a
 * parent that still has at least one counted subtask is replaced by those subtasks.
 */
export function leafItems(items: ProgressItem[]): ProgressItem[] {
  const counted = items.filter((item) => !item.deleted && !item.isMilestone);
  const parentsWithChildren = new Set(
    counted.flatMap((item) => (item.parentId === null ? [] : [item.parentId])),
  );
  return counted.filter((item) => !parentsWithChildren.has(item.id));
}

/** P: share of leaf tasks that are DONE (docs/07 section 2). Percent is not rounded. */
export function countProgress(items: ProgressItem[]): CountProgress {
  const leaves = leafItems(items);
  const done = leaves.filter((item) => item.statusCategory === "DONE").length;
  return { done, total: leaves.length, percent: percentOf(done, leaves.length) };
}

/**
 * P_w: share of estimate that is DONE (docs/07 section 3). `reliable` is true when at least
 * half of the leaf tasks have an estimate; otherwise the UI shows P instead.
 */
export function weightedProgress(items: ProgressItem[]): WeightedProgress {
  const leaves = leafItems(items);
  let done = 0;
  let total = 0;
  let estimated = 0;
  for (const item of leaves) {
    const weight = item.estimate ?? DEFAULT_ESTIMATE;
    if (item.estimate !== null) estimated += 1;
    total += weight;
    if (item.statusCategory === "DONE") done += weight;
  }
  return {
    done,
    total,
    percent: percentOf(done, total),
    reliable: leaves.length > 0 && estimated * 2 >= leaves.length,
  };
}
