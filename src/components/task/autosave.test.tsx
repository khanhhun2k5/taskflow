import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/features/query-keys";
import { draftTask } from "@/features/tasks/cache";
import { useTask } from "@/features/tasks/hooks";
import type { TaskDetailDTO, TaskDTO } from "@/features/tasks/schemas";
import { createTestQueryClient, renderWithIntl } from "@/test/intl";
import { DueField } from "./due-field";
import { SaveIndicator } from "./save-indicator";
import { TaskTitleField } from "./task-title-field";
import { AUTOSAVE_DELAY_MS, useDebouncedSave, useTaskSaver, type SaveTask } from "./use-autosave";

// docs/06 section 4.3: autosave 500 ms after typing stops; nothing typed may be lost when
// the dialog closes (Esc unmounts the fields without a blur event).

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => {
  fetchMock.mockReset();
  vi.useRealTimers();
});

const task = draftTask("t1", "Cũ", {}, "2026-11-01T00:00:00.000Z");

describe("useDebouncedSave", () => {
  function Probe({ save }: { save: (value: string) => void }) {
    const { schedule, flush } = useDebouncedSave(save);
    return (
      <>
        <button type="button" onClick={() => schedule("a")}>
          a
        </button>
        <button type="button" onClick={() => schedule("b")}>
          b
        </button>
        <button type="button" onClick={flush}>
          flush
        </button>
      </>
    );
  }

  it("saves the last value once, 500 ms after the last change", () => {
    vi.useFakeTimers();
    const save = vi.fn();
    render(<Probe save={save} />);
    fireEvent.click(screen.getByText("a"));
    fireEvent.click(screen.getByText("b"));
    act(() => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1));
    expect(save).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(save).toHaveBeenCalledExactlyOnceWith("b");
  });

  it("flush saves at once, and a pending value is saved on unmount", () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const { unmount } = render(<Probe save={save} />);
    fireEvent.click(screen.getByText("a"));
    fireEvent.click(screen.getByText("flush"));
    expect(save).toHaveBeenCalledExactlyOnceWith("a");
    fireEvent.click(screen.getByText("b"));
    unmount();
    expect(save).toHaveBeenLastCalledWith("b");
    expect(save).toHaveBeenCalledTimes(2);
  });
});

describe("fields save what was typed when the dialog closes", () => {
  it("TaskTitleField", () => {
    const save = vi.fn<SaveTask>();
    const { unmount } = renderWithIntl(<TaskTitleField task={task} save={save} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Tiêu đề" }), {
      target: { value: "  Mới  " },
    });
    unmount();
    expect(save).toHaveBeenCalledExactlyOnceWith({ title: "Mới" }, { title: "Mới" });
  });

  it("DueField time, converted from User.timezone (NFR-32)", () => {
    const save = vi.fn<SaveTask>();
    // 09:00 on 03/11/2026 in UTC (renderWithIntl uses timeZone "UTC").
    const timed = { ...task, dueAt: "2026-11-03T09:00:00.000Z", dueAllDay: false };
    const { unmount } = renderWithIntl(<DueField task={timed} save={save} />);
    fireEvent.change(screen.getByLabelText("Giờ"), { target: { value: "14:30" } });
    unmount();
    const dueAt = "2026-11-03T14:30:00.000Z";
    expect(save).toHaveBeenCalledExactlyOnceWith(
      { dueAt, dueAllDay: false },
      { dueAt, dueAllDay: false, isOverdue: false },
    );
  });
});

describe("overlapping saves (useTaskSaver + optimistic rollback)", () => {
  function Saver() {
    useTask("t1"); // an observer, like the open TaskDialog, so invalidation refetches
    const { state, save } = useTaskSaver("t1");
    return (
      <>
        <SaveIndicator state={state} />
        <button type="button" onClick={() => save({ title: "A" }, { title: "A" })}>
          A
        </button>
        <button type="button" onClick={() => save({ priority: "HIGH" }, { priority: "HIGH" })}>
          B
        </button>
      </>
    );
  }

  it("keeps the later change on screen and reports the earlier failure", async () => {
    const releases: ((response: Response) => void)[] = [];
    fetchMock.mockImplementation((_url, init) =>
      init?.method === "PATCH"
        ? new Promise((resolve) => releases.push(resolve))
        : Promise.resolve(new Response(JSON.stringify({ ...task, priority: "HIGH" }))),
    );
    const queryClient = createTestQueryClient();
    const detail: TaskDetailDTO = { ...task, subtasks: [], activity: [] };
    queryClient.setQueryData(queryKeys.tasks.detail("t1"), detail);
    const cached = () => queryClient.getQueryData<TaskDTO>(queryKeys.tasks.detail("t1"));
    renderWithIntl(<Saver />, { queryClient });

    fireEvent.click(screen.getByText("A"));
    fireEvent.click(screen.getByText("B"));
    await waitFor(() => expect(releases).toHaveLength(2));
    expect(cached()).toMatchObject({ title: "A", priority: "HIGH" });

    // A fails while B is still in flight: B's optimistic priority must survive.
    act(() =>
      releases[0](
        new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR" } }), { status: 500 }),
      ),
    );
    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(2));
    expect(cached()?.priority).toBe("HIGH");
    expect(screen.getByRole("status").textContent).toContain("Đang lưu");

    act(() => releases[1](new Response(JSON.stringify({ ...task, priority: "HIGH" }))));
    // Not "Saved": one of the two saves failed. The refetch shows the server's state.
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Chưa lưu được"));
    await waitFor(() => expect(cached()).toMatchObject({ title: "Cũ", priority: "HIGH" }));
  });
});
