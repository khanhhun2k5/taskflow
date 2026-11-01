import { describe, expect, it } from "vitest";
import { dropTargetFromOver, locate, moveInColumns, planDrop, type ColumnOrder } from "./drop";

const board = (): ColumnOrder[] => [
  { id: "todo", taskIds: ["A", "B", "C", "D"] },
  { id: "doing", taskIds: ["E", "F"] },
  { id: "done", taskIds: [] },
];
const order = (columns: ColumnOrder[], id: string) =>
  columns.find((column) => column.id === id)?.taskIds;

describe("same column (indexes are counted WITHOUT the dragged task)", () => {
  it("dragging DOWN: B between C and D → A,C,B,D", () => {
    // Without B the column is A,C,D; between C and D is index 2.
    const target = { columnId: "todo", index: 2 };
    expect(order(moveInColumns(board(), "B", target), "todo")).toEqual(["A", "C", "B", "D"]);
    expect(planDrop(board(), "B", target)).toEqual({
      columnId: "todo",
      beforeId: "C",
      afterId: "D",
    });
  });

  it("dragging UP: C between A and B → A,C,B,D", () => {
    // Without C the column is A,B,D; between A and B is index 1.
    const target = { columnId: "todo", index: 1 };
    expect(order(moveInColumns(board(), "C", target), "todo")).toEqual(["A", "C", "B", "D"]);
    expect(planDrop(board(), "C", target)).toEqual({
      columnId: "todo",
      beforeId: "A",
      afterId: "B",
    });
  });

  it("to the top and to the bottom", () => {
    expect(planDrop(board(), "C", { columnId: "todo", index: 0 })).toEqual({
      columnId: "todo",
      beforeId: null,
      afterId: "A",
    });
    expect(planDrop(board(), "B", { columnId: "todo", index: 3 })).toEqual({
      columnId: "todo",
      beforeId: "D",
      afterId: null,
    });
  });

  it("dropping back at the original position sends no /move", () => {
    expect(planDrop(board(), "B", { columnId: "todo", index: 1 })).toBeNull();
    expect(planDrop(board(), "A", { columnId: "todo", index: 0 })).toBeNull();
    expect(planDrop(board(), "D", { columnId: "todo", index: 3 })).toBeNull();
  });

  it("dropping a card on itself sends no /move", () => {
    const target = dropTargetFromOver(board(), "B", "B");
    expect(target).toEqual({ columnId: "todo", index: 1 });
    expect(target && planDrop(board(), "B", target)).toBeNull();
  });

  it("over another card uses arrayMove semantics in both directions", () => {
    // B over C (moving down) lands where C was; C over B (moving up) lands where B was.
    const down = dropTargetFromOver(board(), "B", "C");
    const up = dropTargetFromOver(board(), "C", "B");
    expect(down && order(moveInColumns(board(), "B", down), "todo")).toEqual(["A", "C", "B", "D"]);
    expect(up && order(moveInColumns(board(), "C", up), "todo")).toEqual(["A", "C", "B", "D"]);
  });
});

describe("another column", () => {
  it("at the top, middle and end", () => {
    expect(planDrop(board(), "A", { columnId: "doing", index: 0 })).toEqual({
      columnId: "doing",
      beforeId: null,
      afterId: "E",
    });
    expect(planDrop(board(), "A", { columnId: "doing", index: 1 })).toEqual({
      columnId: "doing",
      beforeId: "E",
      afterId: "F",
    });
    expect(planDrop(board(), "A", { columnId: "doing", index: 2 })).toEqual({
      columnId: "doing",
      beforeId: "F",
      afterId: null,
    });
    const moved = moveInColumns(board(), "A", { columnId: "doing", index: 1 });
    expect(order(moved, "todo")).toEqual(["B", "C", "D"]);
    expect(order(moved, "doing")).toEqual(["E", "A", "F"]);
  });

  it("into an empty column (both neighbours null)", () => {
    expect(planDrop(board(), "B", { columnId: "done", index: 0 })).toEqual({
      columnId: "done",
      beforeId: null,
      afterId: null,
    });
  });

  it("over a column body means the end of that column", () => {
    expect(dropTargetFromOver(board(), "A", "doing")).toEqual({ columnId: "doing", index: 2 });
    expect(dropTargetFromOver(board(), "A", "todo")).toEqual({ columnId: "todo", index: 3 });
  });

  it("over a card goes before it, or after it when below its middle", () => {
    expect(dropTargetFromOver(board(), "A", "F")).toEqual({ columnId: "doing", index: 1 });
    expect(dropTargetFromOver(board(), "A", "F", true)).toEqual({ columnId: "doing", index: 2 });
  });
});

describe("edge cases", () => {
  it("clamps out-of-range indexes and ignores unknown ids", () => {
    expect(planDrop(board(), "A", { columnId: "doing", index: 99 })).toEqual({
      columnId: "doing",
      beforeId: "F",
      afterId: null,
    });
    expect(order(moveInColumns(board(), "A", { columnId: "todo", index: -5 }), "todo")).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
    expect(planDrop(board(), "X", { columnId: "todo", index: 0 })).toBeNull();
    expect(planDrop(board(), "A", { columnId: "nope", index: 0 })).toBeNull();
    expect(moveInColumns(board(), "X", { columnId: "todo", index: 0 })).toEqual(board());
    expect(dropTargetFromOver(board(), "A", "X")).toBeNull();
    expect(locate(board(), "F")).toEqual({ columnId: "doing", index: 1 });
  });
});
