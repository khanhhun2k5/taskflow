import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";

// jsdom drops the leading space of the sr-only " (Sắp có)" text; Chrome keeps it
// (checked by tests/e2e/auth.spec.ts), hence the optional space in the patterns below.
vi.mock("next/navigation", () => ({ usePathname: () => "/today" }));

describe("Sidebar (docs/06 section 2)", () => {
  it("marks Today as the current page", () => {
    renderWithIntl(<Sidebar />);
    const nav = screen.getByRole("navigation", { name: "Điều hướng chính" });
    const today = within(nav).getByRole("link", { name: "Hôm nay" });
    expect(today.getAttribute("aria-current")).toBe("page");
    expect(today.getAttribute("href")).toBe("/today");
  });

  it("shows empty Courses and Projects sections with disabled add buttons", () => {
    renderWithIntl(<Sidebar />);
    const courses = screen.getByRole("region", { name: "Môn học" });
    expect(within(courses).getByText("Chưa có môn học")).toBeTruthy();
    expect(within(courses).getByRole("button", { name: /^Thêm môn ?\(Sắp có\)$/ })).toHaveProperty(
      "disabled",
      true,
    );

    const projects = screen.getByRole("region", { name: "Dự án" });
    expect(within(projects).getByText("Chưa có dự án")).toBeTruthy();
    expect(
      within(projects).getByRole("button", { name: /^Thêm dự án ?\(Sắp có\)$/ }),
    ).toHaveProperty("disabled", true);
  });

  it("does not link to pages from later phases", () => {
    renderWithIntl(<Sidebar />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("Hộp thư")).toBeTruthy();
  });
});

describe("BottomNav", () => {
  it("has the four phone items", () => {
    renderWithIntl(<BottomNav />);
    const nav = screen.getByRole("navigation", { name: "Điều hướng chính" });
    expect(within(nav).getAllByRole("listitem")).toHaveLength(4);
    expect(within(nav).getByRole("link", { name: "Hôm nay" })).toBeTruthy();
    expect(within(nav).getByText("Dự án & Môn")).toBeTruthy();
    expect(within(nav).getByRole("button", { name: /^Thêm ?\(Sắp có\)$/ })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
