import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { ThemeToggle } from "./theme-toggle";

const setTheme = vi.fn();
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", setTheme }),
}));

describe("ThemeToggle", () => {
  beforeEach(() => setTheme.mockClear());

  it("offers light, dark and system and switches with the keyboard", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ThemeToggle />);

    const trigger = screen.getByRole("button", { name: "Đổi giao diện" });
    trigger.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("menuitemradio", { name: "Sáng" })).toBeTruthy();
    expect(screen.getByRole("menuitemradio", { name: "Theo hệ thống" })).toHaveProperty(
      "ariaChecked",
      "true",
    );

    await user.click(screen.getByRole("menuitemradio", { name: "Tối" }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("uses English labels for locale en", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ThemeToggle />, { locale: "en" });
    await user.click(screen.getByRole("button", { name: "Change theme" }));
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toBeTruthy();
  });
});
