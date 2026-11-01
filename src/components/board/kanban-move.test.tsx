import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import type { BoardDTO } from "@/features/boards/schemas";
import { queryKeys } from "@/features/query-keys";
import { draftTask } from "@/features/tasks/cache";
import { useMoveTask } from "@/features/tasks/hooks";
import { createTestQueryClient, renderWithIntl } from "@/test/intl";
import { KanbanBoard } from "./kanban-board";

// docs/06 section 1.3 + 4.4: a drop shows at once, rolls back on error, and a refetch with
// old data while /move is pending must not make the card jump back.

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => fetchMock.mockReset());

const NOW = "2026-11-01T00:00:00.000Z";
const task = (id: string, columnId: string) =>
  draftTask(id, `Việc ${id}`, { columnId, projectId: "p" }, NOW);
const column = (
  id: string,
  name: string,
  statusCategory: BoardDTO["columns"][number]["statusCategory"],
  tasks = [] as ReturnType<typeof task>[],
) => ({
  id,
  name,
  statusCategory,
  order: id,
  wipLimit: null,
  wipStrict: false,
  tasks,
});
const board = (): BoardDTO => ({
  id: "b",
  projectId: "p",
  courseId: null,
  columns: [
    column("todo", "Cần làm", "TODO", [task("A", "todo"), task("B", "todo")]),
    column("done", "Xong", "DONE"),
  ],
});

/** Stands in for a drop: the same mutation the board's onDragEnd sends. */
function DropB() {
  const move = useMoveTask();
  return (
    <button
      type="button"
      onClick={() =>
        move.mutate({
          id: "B",
          boardId: "b",
          target: { columnId: "done", index: 0 },
          statusCategory: "DONE",
          beforeId: null,
          afterId: null,
        })
      }
    >
      drop B on Xong
    </button>
  );
}

function setup() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.boards.detail("b"), board());
  renderWithIntl(
    <>
      <KanbanBoard boardId="b" projectId="p" readOnly={false} onOpen={() => {}} />
      <DropB />
      <Toaster />
    </>,
    { queryClient },
  );
  const cards = (name: string) =>
    within(screen.getByRole("region", { name: new RegExp(`^${name}`) }))
      .queryAllByRole("button", { name: /^Việc: / })
      .map((card) => card.getAttribute("data-task-id"));
  return { queryClient, cards };
}

describe("Kanban drop (optimistic /move)", () => {
  it("moves at once and rolls back with a toast when /move fails", async () => {
    let fail: (response: Response) => void = () => {};
    fetchMock.mockImplementation((_url, init) =>
      init?.method === "POST"
        ? new Promise((resolve) => (fail = resolve))
        : Promise.resolve(new Response(JSON.stringify(board()))),
    );
    const { cards } = setup();
    expect(cards("Cần làm")).toEqual(["A", "B"]);

    act(() => screen.getByText("drop B on Xong").click());
    await waitFor(() => expect(cards("Xong")).toEqual(["B"]));

    const body = { error: { code: "WIP_LIMIT_EXCEEDED", message: "full" } };
    act(() => fail(new Response(JSON.stringify(body), { status: 409 })));
    await waitFor(() => expect(cards("Cần làm")).toEqual(["A", "B"]));
    expect(cards("Xong")).toEqual([]);
    expect(await screen.findByText("Cột đã đạt giới hạn số việc (WIP).")).toBeTruthy();
  });

  it("keeps the dropped card in place when a refetch returns old data mid-request", async () => {
    let succeed: (response: Response) => void = () => {};
    const moved = board();
    moved.columns = [
      column("todo", "Cần làm", "TODO", [task("A", "todo")]),
      column("done", "Xong", "DONE", [{ ...task("B", "done"), statusCategory: "DONE" }]),
    ];
    let server = board();
    fetchMock.mockImplementation((_url, init) =>
      init?.method === "POST"
        ? new Promise((resolve) => (succeed = resolve))
        : Promise.resolve(new Response(JSON.stringify(server))),
    );
    const { queryClient, cards } = setup();

    act(() => screen.getByText("drop B on Xong").click());
    await waitFor(() => expect(cards("Xong")).toEqual(["B"]));

    // A window-focus refetch (or any invalidation) lands with the pre-move board.
    // Let TanStack flush its batched notifications so the UI really re-renders.
    await act(async () => {
      queryClient.setQueryData(queryKeys.boards.detail("b"), board());
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(cards("Xong")).toEqual(["B"]);
    expect(cards("Cần làm")).toEqual(["A"]);

    server = moved;
    const getsBefore = fetchMock.mock.calls.filter(([, init]) => !init?.method).length;
    act(() => succeed(new Response(JSON.stringify({ ...task("B", "done"), warnings: [] }))));
    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
    await waitFor(() => expect(cards("Xong")).toEqual(["B"]));
    expect(cards("Cần làm")).toEqual(["A"]);
    // NFR-03: the /move answer is written into the board; the board is not fetched again.
    const boardGets = fetchMock.mock.calls
      .slice(getsBefore)
      .filter(([url, init]) => !init?.method && String(url).includes("/boards/"));
    expect(boardGets).toHaveLength(0);
    expect(server).toBe(moved);
  });
});
