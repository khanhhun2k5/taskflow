import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectListItemDTO } from "@/features/projects/schemas";
import { queryKeys } from "@/features/query-keys";
import { createTestQueryClient, renderWithIntl } from "@/test/intl";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";

// jsdom drops the leading space of the sr-only " (Sắp có)" text; Chrome keeps it
// (checked by tests/e2e/auth.spec.ts), hence the optional space in the patterns below.
vi.mock("next/navigation", () => ({ usePathname: () => "/projects/p1" }));

const project = (id: string, name: string): ProjectListItemDTO => ({
  id,
  name,
  description: null,
  color: "#6366F1",
  workflow: "KANBAN",
  estimateUnit: "POINTS",
  status: "ACTIVE",
  startDate: null,
  endDate: null,
  boardId: `b-${id}`,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  progress: 0,
  weightedReliable: false,
  overdueCount: 0,
});

function renderSidebar(projects: ProjectListItemDTO[]) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.projects.list("ACTIVE"), {
    items: projects,
    nextCursor: null,
  });
  return renderWithIntl(<Sidebar />, { queryClient });
}

describe("Sidebar (docs/06 section 2)", () => {
  it("links Today, Inbox and Trash; Calendar and Settings are still coming soon", () => {
    renderSidebar([]);
    const nav = screen.getByRole("navigation", { name: "Điều hướng chính" });
    expect(within(nav).getByRole("link", { name: "Hôm nay" }).getAttribute("href")).toBe("/today");
    expect(within(nav).getByRole("link", { name: "Hộp thư" }).getAttribute("href")).toBe("/inbox");
    expect(within(nav).getByRole("link", { name: "Thùng rác" }).getAttribute("href")).toBe(
      "/trash",
    );
    expect(within(nav).queryByRole("link", { name: /Lịch/ })).toBeNull();
    expect(within(nav).queryByRole("link", { name: /Cài đặt/ })).toBeNull();
  });

  it("keeps the Courses section empty with a disabled add button", () => {
    renderSidebar([]);
    const courses = screen.getByRole("region", { name: "Môn học" });
    expect(within(courses).getByText("Chưa có môn học")).toBeTruthy();
    expect(within(courses).getByRole("button", { name: /^Thêm môn ?\(Sắp có\)$/ })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("lists the user's projects and marks the current one", () => {
    renderSidebar([project("p1", "Website"), project("p2", "Luận văn")]);
    const projects = screen.getByRole("region", { name: "Dự án" });
    const current = within(projects).getByRole("link", { name: "Website" });
    expect(current.getAttribute("href")).toBe("/projects/p1");
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(within(projects).getByRole("link", { name: "Luận văn" })).toBeTruthy();
    expect(within(projects).getByRole("link", { name: "Thêm dự án" }).getAttribute("href")).toBe(
      "/projects?new=1",
    );
  });

  it("shows the empty text when there are no projects", () => {
    renderSidebar([]);
    const projects = screen.getByRole("region", { name: "Dự án" });
    expect(within(projects).getByText("Chưa có dự án")).toBeTruthy();
  });
});

describe("BottomNav", () => {
  it("has the four phone items", () => {
    renderWithIntl(<BottomNav />);
    const nav = screen.getByRole("navigation", { name: "Điều hướng chính" });
    expect(within(nav).getAllByRole("listitem")).toHaveLength(4);
    expect(within(nav).getByRole("link", { name: "Hôm nay" })).toBeTruthy();
    expect(within(nav).getByRole("link", { name: "Dự án & Môn" }).getAttribute("href")).toBe(
      "/projects",
    );
    expect(within(nav).getByRole("button", { name: /^Thêm ?\(Sắp có\)$/ })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
