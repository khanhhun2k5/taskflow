import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { QuickAdd } from "./quick-add";

function setup() {
  const onSubmit = vi.fn<(title: string) => void>();
  renderWithIntl(<QuickAdd label="Thêm việc mới" placeholder="Thêm việc…" onSubmit={onSubmit} />);
  return { onSubmit, input: screen.getByRole("textbox", { name: "Thêm việc mới" }) };
}

describe("QuickAdd (docs/06 section 4.1)", () => {
  it("Enter creates the trimmed title, empties the box and keeps focus", async () => {
    const user = userEvent.setup();
    const { onSubmit, input } = setup();
    await user.type(input, "  Viết báo cáo  {Enter}");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("Viết báo cáo");
    expect(input).toHaveProperty("value", "");
    expect(document.activeElement).toBe(input);

    await user.type(input, "Việc thứ hai{Enter}");
    expect(onSubmit).toHaveBeenLastCalledWith("Việc thứ hai");
  });

  it("Esc clears the text and leaves the box", async () => {
    const user = userEvent.setup();
    const { onSubmit, input } = setup();
    await user.type(input, "Nháp");
    await user.keyboard("{Escape}");
    expect(input).toHaveProperty("value", "");
    expect(document.activeElement).not.toBe(input);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does nothing for an empty or whitespace-only title", async () => {
    const user = userEvent.setup();
    const { onSubmit, input } = setup();
    await user.click(input);
    await user.keyboard("{Enter}");
    await user.type(input, "   {Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input).toHaveProperty("value", "   ");
  });
});
