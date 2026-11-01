import { describe, expect, it } from "vitest";
import { hasFilters, parseListParams, toListQuery, writeListParams } from "./list-params";

const parse = (query: string) => parseListParams(new URLSearchParams(query));

describe("ListView URL params (docs/06 section 4.5)", () => {
  it("reads valid filters and drops invalid ones", () => {
    expect(
      parse(
        "status=DONE&priority=HIGH&label=l1&from=2026-11-01&to=2026-11-30&overdue=true&q=%20báo%20cáo%20&sort=-dueAt",
      ),
    ).toEqual({
      status: "DONE",
      priority: "HIGH",
      labelId: "l1",
      from: "2026-11-01",
      to: "2026-11-30",
      overdue: true,
      q: "báo cáo",
      sort: "-dueAt",
    });
    expect(
      parse("status=NOPE&priority=x&from=01/11/2026&overdue=yes&sort=random&q=%20%20"),
    ).toEqual({});
  });

  it("writes filters next to unrelated params and round-trips", () => {
    const written = writeListParams("view=list&task=t1&status=TODO", {
      priority: "LOW",
      overdue: true,
    });
    const search = new URLSearchParams(written);
    expect(search.get("view")).toBe("list");
    expect(search.get("task")).toBe("t1");
    expect(search.get("status")).toBeNull();
    expect(parseListParams(search)).toEqual({ priority: "LOW", overdue: true });
  });

  it("hasFilters ignores the sort", () => {
    expect(hasFilters({ sort: "title" })).toBe(false);
    expect(hasFilters({ q: "x" })).toBe(true);
  });

  it("builds the GET /tasks query with day bounds in the user's zone", () => {
    expect(toListQuery({ inbox: true }, {}, "UTC")).toEqual({ inbox: "true" });
    expect(
      toListQuery(
        { projectId: "p1" },
        {
          from: "2026-11-03",
          to: "2026-11-03",
          status: "TODO",
          priority: "URGENT",
          labelId: "l",
          overdue: true,
          q: "a",
          sort: "title",
        },
        "Asia/Ho_Chi_Minh",
      ),
    ).toEqual({
      projectId: "p1",
      topLevel: "true",
      dueFrom: "2026-11-02T17:00:00.000Z",
      dueTo: "2026-11-03T16:59:59.999Z",
      status: "TODO",
      priority: "URGENT",
      labelId: "l",
      overdue: "true",
      q: "a",
      sort: "title",
    });
  });
});
