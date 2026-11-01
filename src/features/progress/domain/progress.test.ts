import { describe, expect, it } from "vitest";
import { countProgress, leafItems, type ProgressItem, weightedProgress } from "./progress";

let nextId = 0;
function task(overrides: Partial<ProgressItem> = {}): ProgressItem {
  nextId += 1;
  return {
    id: `t${nextId}`,
    parentId: null,
    statusCategory: "TODO",
    estimate: null,
    isMilestone: false,
    deleted: false,
    ...overrides,
  };
}

const done = (overrides: Partial<ProgressItem> = {}) =>
  task({ statusCategory: "DONE", ...overrides });

describe("progress (docs/07)", () => {
  it("TC-01 no tasks → P = 0, P_w = 0, no error", () => {
    expect(countProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
    expect(weightedProgress([])).toEqual({ done: 0, total: 0, percent: 0, reliable: false });
  });

  it("TC-02 estimates 2, 3, 5 with the 5 done → P ≈ 33.3%, P_w = 50%", () => {
    const items = [task({ estimate: 2 }), task({ estimate: 3 }), done({ estimate: 5 })];
    expect(countProgress(items).percent).toBeCloseTo(100 / 3, 10);
    expect(weightedProgress(items)).toEqual({ done: 5, total: 10, percent: 50, reliable: true });
  });

  it("TC-03 3 (done), 5, none (done), none → P_w = 40%, reliable", () => {
    const items = [done({ estimate: 3 }), task({ estimate: 5 }), done(), task()];
    expect(weightedProgress(items)).toEqual({ done: 4, total: 10, percent: 40, reliable: true });
  });

  it("TC-04 4 tasks, only 1 estimated → not reliable", () => {
    const items = [task({ estimate: 3 }), task(), task(), task()];
    expect(weightedProgress(items).reliable).toBe(false);
  });

  it("TC-05 task A + task B with 3 subtasks; A and B1 done → 4 leaves, P = 50%", () => {
    const a = done({ id: "A" });
    const b = task({ id: "B" });
    const b1 = done({ id: "B1", parentId: "B" });
    const b2 = task({ id: "B2", parentId: "B" });
    const b3 = task({ id: "B3", parentId: "B" });
    const items = [a, b, b1, b2, b3];

    expect(leafItems(items).map((item) => item.id)).toEqual(["A", "B1", "B2", "B3"]);
    expect(countProgress(items)).toEqual({ done: 2, total: 4, percent: 50 });
  });

  it("TC-06 deleted tasks and milestones are not counted", () => {
    const items = [
      done({ id: "kept" }),
      task({ id: "open" }),
      done({ id: "deleted", deleted: true }),
      task({ id: "milestone", isMilestone: true }),
    ];
    expect(leafItems(items).map((item) => item.id)).toEqual(["kept", "open"]);
    expect(countProgress(items)).toEqual({ done: 1, total: 2, percent: 50 });
  });

  it("TC-07 every estimate is 0 → P_w = 0, no division by zero", () => {
    const items = [done({ estimate: 0 }), task({ estimate: 0 })];
    expect(weightedProgress(items)).toEqual({ done: 0, total: 0, percent: 0, reliable: true });
  });

  it("a parent whose subtasks are all deleted counts as a leaf again", () => {
    const parent = done({ id: "P" });
    const child = task({ id: "C", parentId: "P", deleted: true });
    expect(leafItems([parent, child]).map((item) => item.id)).toEqual(["P"]);
  });

  it("IN_PROGRESS is not done", () => {
    expect(countProgress([task({ statusCategory: "IN_PROGRESS" })]).done).toBe(0);
  });
});
