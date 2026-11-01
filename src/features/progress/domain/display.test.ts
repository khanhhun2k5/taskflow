import { describe, expect, it } from "vitest";
import { pickDisplayedProgress, roundPercent } from "./display";

describe("roundPercent (docs/07 section 3)", () => {
  it("rounds halves up and clamps to 0–100", () => {
    expect(roundPercent(33.5)).toBe(34);
    expect(roundPercent(100 / 3)).toBe(33);
    expect(roundPercent(66.49)).toBe(66);
    expect(roundPercent(-0.2)).toBe(0);
    expect(roundPercent(100.4)).toBe(100);
  });
});

describe("pickDisplayedProgress", () => {
  it("shows P_w when enough tasks are estimated (example 1)", () => {
    expect(pickDisplayedProgress({ count: 100 / 3, weighted: 50, weightedReliable: true })).toEqual(
      { percent: 50, kind: "weighted", showEstimateHint: false },
    );
  });

  it("falls back to P with the estimate hint otherwise", () => {
    expect(
      pickDisplayedProgress({ count: 100 / 3, weighted: 80, weightedReliable: false }),
    ).toEqual({ percent: 33, kind: "count", showEstimateHint: true });
  });
});
