import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskRow } from "@/components/task/task-row";
import { Toaster } from "@/components/ui/sonner";
import { queryKeys } from "@/features/query-keys";
import { draftTask } from "@/features/tasks/cache";
import { allItems, firstPage, type Pages } from "@/features/infinite";
import { useSetTaskStatus } from "@/features/tasks/hooks";
import { useTaskList } from "@/features/tasks/list-hooks";
import { useRestore } from "@/features/tasks/trash-hooks";
import type { TrashItemDTO } from "@/features/tasks/schemas";
import { createTestQueryClient, renderWithIntl } from "@/test/intl";

// NFR-51 / docs/06 section 1.3: optimistic update, rollback on error, toast with "Retry".

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => fetchMock.mockReset());

const errorResponse = (status: number, code: string) =>
  new Response(JSON.stringify({ error: { code, message: "technical detail" } }), { status });

const task = draftTask("t1", "Viết báo cáo", {}, "2026-11-01T00:00:00.000Z");

function Inbox() {
  const tasks = useTaskList({ inbox: true }, {});
  const setStatus = useSetTaskStatus();
  return (
    <ul>
      {allItems(tasks.data).map((item) => (
        <TaskRow
          key={item.id}
          task={item}
          onOpen={() => {}}
          onToggle={(id, status) => setStatus.mutate({ id, status })}
        />
      ))}
    </ul>
  );
}

function renderInbox() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    queryKeys.tasks.list({ inbox: true }, {}),
    firstPage({ items: [task], nextCursor: null }),
  );
  renderWithIntl(
    <>
      <Inbox />
      <Toaster />
    </>,
    { queryClient },
  );
  return screen.getByRole("checkbox", { name: "Đánh dấu xong: Viết báo cáo" });
}

describe("optimistic mutations", () => {
  it("rolls back a failed change and offers Retry, which sends the request again", async () => {
    const user = userEvent.setup();
    // A tiny fake server: GET returns the stored task, PATCH answers with `patch()`.
    let stored = task;
    let patch: () => Promise<Response> = () =>
      Promise.resolve(errorResponse(500, "INTERNAL_ERROR"));
    fetchMock.mockImplementation((_url, init) => {
      if (init?.method === "PATCH") return patch();
      return Promise.resolve(new Response(JSON.stringify({ items: [stored], nextCursor: null })));
    });
    let release: (response: Response) => void = () => {};
    patch = () => new Promise((resolve) => (release = resolve));
    const checkbox = renderInbox();

    await user.click(checkbox);
    // Optimistic: checked before the server answers (NFR-04).
    expect(checkbox.getAttribute("aria-checked")).toBe("true");

    release(errorResponse(500, "INTERNAL_ERROR"));
    await waitFor(() => expect(checkbox.getAttribute("aria-checked")).toBe("false"));
    expect(await screen.findByText("Máy chủ gặp sự cố. Vui lòng thử lại.")).toBeTruthy();
    expect(screen.queryByText("technical detail")).toBeNull();

    patch = () => {
      stored = { ...task, statusCategory: "DONE" };
      return Promise.resolve(new Response(JSON.stringify(stored)));
    };
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(checkbox.getAttribute("aria-checked")).toBe("true"));
    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(patches).toHaveLength(2);
    expect(patches[1][0]).toBe("/api/v1/tasks/t1");
    expect(patches[1][1]?.body).toBe('{"statusCategory":"DONE"}');
  });

  it("explains business errors without a Retry button (PARENT_DELETED)", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_url, init) =>
      Promise.resolve(
        init?.method === "POST"
          ? errorResponse(422, "PARENT_DELETED")
          : new Response(JSON.stringify({ items: [], nextCursor: null })),
      ),
    );
    const queryClient = createTestQueryClient();
    const item: TrashItemDTO = {
      type: "task",
      id: "t9",
      title: "Việc con",
      projectId: null,
      deletedAt: "2026-11-01T00:00:00.000Z",
    };
    queryClient.setQueryData(queryKeys.trash.all, firstPage({ items: [item], nextCursor: null }));

    function RestoreButton() {
      const restore = useRestore();
      return (
        <button type="button" onClick={() => restore.mutate(item)}>
          Khôi phục
        </button>
      );
    }
    renderWithIntl(
      <>
        <RestoreButton />
        <Toaster />
      </>,
      { queryClient },
    );

    await user.click(screen.getByRole("button", { name: "Khôi phục" }));
    const message = await screen.findByText(/việc cha hoặc dự án chứa việc này vẫn ở thùng rác/);
    // sonner keeps toasts of earlier tests in module state, so look inside this toast only.
    const toastElement = message.closest("[data-sonner-toast]");
    expect(toastElement).not.toBeNull();
    expect(
      within(toastElement as HTMLElement).queryByRole("button", { name: "Thử lại" }),
    ).toBeNull();
    // Rolled back: the item is back in the trash cache.
    expect(allItems(queryClient.getQueryData<Pages<TrashItemDTO>>(queryKeys.trash.all))).toEqual([
      item,
    ]);
  });
});
