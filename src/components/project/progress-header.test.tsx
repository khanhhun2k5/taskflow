import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProjectProgressDTO } from "@/features/projects/schemas";
import { renderWithIntl } from "@/test/intl";
import { ProgressSummaryView } from "./progress-header";

const base: ProjectProgressDTO = {
  count: 100 / 3,
  weighted: 50,
  weightedReliable: true,
  done: 1,
  total: 3,
  overdue: [],
};

describe("ProgressHeader (docs/07 section 3)", () => {
  it("shows P_w when weightedReliable", () => {
    renderWithIntl(<ProgressSummaryView progress={base} name="Website" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("50");
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText(/Theo ước lượng/)).toBeTruthy();
    expect(screen.queryByText("Thêm ước lượng để xem tiến độ chính xác hơn")).toBeNull();
  });

  it("shows P (rounded) and the estimate hint otherwise", () => {
    renderWithIntl(
      <ProgressSummaryView progress={{ ...base, weightedReliable: false }} name="Website" />,
    );
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("33");
    expect(screen.getByText("33%")).toBeTruthy();
    expect(screen.getByText(/Theo số việc/)).toBeTruthy();
    expect(screen.getByText("Thêm ước lượng để xem tiến độ chính xác hơn")).toBeTruthy();
  });

  it("rounds halves up for display", () => {
    renderWithIntl(<ProgressSummaryView progress={{ ...base, weighted: 33.5 }} name="Website" />);
    expect(screen.getByText("34%")).toBeTruthy();
    expect(screen.getByText("1/3 việc xong")).toBeTruthy();
  });
});
