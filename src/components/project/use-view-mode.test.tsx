import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readStoredView, storeView, useViewMode } from "./use-view-mode";

let search = new URLSearchParams();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/projects/p1",
  useSearchParams: () => search,
}));

afterEach(() => {
  search = new URLSearchParams();
  replace.mockReset();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("Kanban | List per project (localStorage, docs/06 section 3)", () => {
  it("defaults to Kanban, then remembers the choice per project", () => {
    expect(renderHook(() => useViewMode("p1")).result.current.view).toBe("kanban");
    renderHook(() => useViewMode("p1")).result.current.setView("list");
    expect(replace).toHaveBeenCalledWith("/projects/p1?view=list", { scroll: false });
    expect(readStoredView("p1")).toBe("list");
    expect(renderHook(() => useViewMode("p1")).result.current.view).toBe("list");
    expect(renderHook(() => useViewMode("p2")).result.current.view).toBe("kanban");
  });

  it("the URL wins over the stored choice", () => {
    storeView("p1", "list");
    search = new URLSearchParams("view=kanban");
    expect(renderHook(() => useViewMode("p1")).result.current.view).toBe("kanban");
  });

  it("falls back to the default when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const { result } = renderHook(() => useViewMode("p1"));
    expect(result.current.view).toBe("kanban");
    expect(() => result.current.setView("list")).not.toThrow();
    expect(replace).toHaveBeenCalledWith("/projects/p1?view=list", { scroll: false });
  });

  it("ignores unknown stored values", () => {
    window.localStorage.setItem("taskflow:view:p1", "calendar");
    expect(readStoredView("p1")).toBeNull();
  });
});
