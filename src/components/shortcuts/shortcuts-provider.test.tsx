import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import {
  ShortcutsProvider,
  useRegisterShortcuts,
  type ShortcutHandlers,
} from "./shortcuts-provider";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function Page({ handlers }: { handlers: ShortcutHandlers }) {
  useRegisterShortcuts(handlers);
  return (
    <>
      <input aria-label="Thêm việc" data-quick-add="" />
      <input aria-label="Ô khác" />
      <button type="button" data-task-id="t1">
        Việc 1
      </button>
    </>
  );
}

function setup() {
  const handlers = { open: vi.fn(), toggleSelect: vi.fn(), markDone: vi.fn(), setView: vi.fn() };
  renderWithIntl(
    <ShortcutsProvider>
      <Page handlers={handlers} />
    </ShortcutsProvider>,
  );
  return handlers;
}

describe("keyboard shortcuts (docs/06 section 5)", () => {
  it("do nothing while focus is in a text field", async () => {
    const user = userEvent.setup();
    const handlers = setup();
    await user.click(screen.getByRole("textbox", { name: "Ô khác" }));
    await user.keyboard("n2x?");
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Ô khác" }));
    expect(handlers.setView).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Phím tắt" })).toBeNull();
  });

  it("do nothing while a Vietnamese input method is composing", () => {
    const handlers = setup();
    fireEvent.keyDown(document.body, { key: "2", isComposing: true });
    fireEvent.keyDown(document.body, { key: "2", keyCode: 229 });
    expect(handlers.setView).not.toHaveBeenCalled();
  });

  it("n focuses the quick add box; 1/2 switch views; g i goes to the inbox", async () => {
    const user = userEvent.setup();
    const handlers = setup();
    await user.keyboard("n");
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Thêm việc" }));
    (document.activeElement as HTMLElement).blur();
    await user.keyboard("12");
    expect(handlers.setView.mock.calls).toEqual([["kanban"], ["list"]]);
    await user.keyboard("gi");
    expect(push).toHaveBeenCalledWith("/inbox");
  });

  it("e, x and Shift+D act on the focused task", async () => {
    const user = userEvent.setup();
    const handlers = setup();
    screen.getByRole("button", { name: "Việc 1" }).focus();
    await user.keyboard("e");
    await user.keyboard("x");
    await user.keyboard("{Shift>}D{/Shift}");
    expect(handlers.open).toHaveBeenCalledWith("t1");
    expect(handlers.toggleSelect).toHaveBeenCalledWith("t1");
    expect(handlers.markDone).toHaveBeenCalledWith("t1");
  });

  it("? opens the shortcut list", async () => {
    const user = userEvent.setup();
    setup();
    await user.keyboard("?");
    expect(await screen.findByRole("dialog", { name: "Phím tắt" })).toBeTruthy();
    expect(screen.getByText("Tới Hộp thư")).toBeTruthy();
  });
});
