import { describe, expect, it } from "vitest";
import { checkWip, checkWipMany, wipCount, type WipTask } from "./wip";

function parents(count: number, prefix = "p"): WipTask[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i}`,
    parentId: null,
    deleted: false,
  }));
}

const incoming: WipTask = { id: "new", parentId: null, deleted: false };
const warnColumn = { wipLimit: 3, wipStrict: false };
const strictColumn = { wipLimit: 3, wipStrict: true };

describe("WIP limits (BR-28…BR-30)", () => {
  it("BR-28 no limit → always allowed, never warned", () => {
    expect(checkWip({ wipLimit: null, wipStrict: true }, parents(50), incoming)).toEqual({
      allowed: true,
      warning: false,
    });
  });

  it("TC-20 dropping into a full column in warning mode → allowed with warning", () => {
    expect(checkWip(warnColumn, parents(3), incoming)).toEqual({ allowed: true, warning: true });
  });

  it("TC-21 dropping into a full strict column → rejected", () => {
    expect(checkWip(strictColumn, parents(3), incoming)).toEqual({
      allowed: false,
      warning: true,
    });
  });

  it("reaching the limit exactly is fine", () => {
    expect(checkWip(strictColumn, parents(2), incoming)).toEqual({
      allowed: true,
      warning: false,
    });
  });

  it("TC-22 reordering inside a full strict column is allowed", () => {
    const tasks = parents(3);
    expect(checkWip(strictColumn, tasks, tasks[1])).toEqual({ allowed: true, warning: false });
  });

  it("reordering inside an already over-limit column is allowed but still warned", () => {
    const tasks = parents(4);
    expect(checkWip(strictColumn, tasks, tasks[0])).toEqual({ allowed: true, warning: true });
  });

  it("TC-23 subtasks do not count: 3 parents with 2 subtasks each, limit 3 → not over", () => {
    const tasks: WipTask[] = parents(3).flatMap((parent) => [
      parent,
      { id: `${parent.id}-a`, parentId: parent.id, deleted: false },
      { id: `${parent.id}-b`, parentId: parent.id, deleted: false },
    ]);
    expect(wipCount(tasks)).toBe(3);
    expect(checkWip(strictColumn, tasks, tasks[0])).toEqual({ allowed: true, warning: false });
  });

  it("moving a subtask never changes the count", () => {
    const subtask: WipTask = { id: "sub", parentId: "elsewhere", deleted: false };
    expect(checkWip(strictColumn, parents(3), subtask)).toEqual({
      allowed: true,
      warning: false,
    });
  });

  it("BR-28 deleted tasks do not count", () => {
    const tasks = [...parents(2), { id: "gone", parentId: null, deleted: true }];
    expect(wipCount(tasks)).toBe(2);
    expect(checkWip(strictColumn, tasks, incoming)).toEqual({ allowed: true, warning: false });
  });
});

describe("checkWipMany (bulk move, column deletion)", () => {
  it("adds all new parent tasks at once", () => {
    const moving = parents(2, "m");
    expect(checkWipMany(strictColumn, parents(1), moving)).toEqual({
      allowed: true,
      warning: false,
    });
    expect(checkWipMany(strictColumn, parents(2), moving)).toEqual({
      allowed: false,
      warning: true,
    });
    expect(checkWipMany(warnColumn, parents(2), moving)).toEqual({ allowed: true, warning: true });
  });

  it("ignores subtasks, deleted tasks, duplicates and tasks already in the column", () => {
    const existing = parents(3);
    const moving: WipTask[] = [
      existing[0],
      { id: "sub", parentId: "x", deleted: false },
      { id: "gone", parentId: null, deleted: true },
    ];
    expect(checkWipMany(strictColumn, existing, moving)).toEqual({
      allowed: true,
      warning: false,
    });
    expect(checkWipMany(strictColumn, parents(2), [incoming, incoming])).toEqual({
      allowed: true,
      warning: false,
    });
  });

  it("no limit → always allowed", () => {
    expect(checkWipMany({ wipLimit: null, wipStrict: true }, parents(9), parents(9, "m"))).toEqual({
      allowed: true,
      warning: false,
    });
  });
});
