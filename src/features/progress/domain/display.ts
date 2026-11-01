// docs/07 section 3: which progress number the UI shows, and how it is rounded.

export type ProgressSummary = { count: number; weighted: number; weightedReliable: boolean };

export type DisplayedProgress = {
  percent: number; // rounded for display
  kind: "weighted" | "count";
  showEstimateHint: boolean; // "Add estimates to see more accurate progress"
};

/** Nearest integer, halves round up (33.5 → 34). Only for display; keep raw values elsewhere. */
export function roundPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.floor(value + 0.5)));
}

/** P_w when at least half the tasks are estimated (weightedReliable), otherwise P + a hint. */
export function pickDisplayedProgress(summary: ProgressSummary): DisplayedProgress {
  return summary.weightedReliable
    ? { percent: roundPercent(summary.weighted), kind: "weighted", showEstimateHint: false }
    : { percent: roundPercent(summary.count), kind: "count", showEstimateHint: true };
}
