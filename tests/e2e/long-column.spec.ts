import { expect, test, type Locator, type Page } from "@playwright/test";
import { registerNewUser } from "./helpers";

// NFR-03 guard: cards use content-visibility:auto, so off-screen cards are not laid out.
// In a scrolled 250-card column, drops must land exactly where they are aimed.

const COUNT = 250;
const pad = (n: number) => `Thẻ ${String(n).padStart(3, "0")}`;

type Board = { columns: { id: string; name: string; tasks: { title: string }[] }[] };

async function seedLongColumn(page: Page) {
  const created = await page.request.post("/api/v1/projects", { data: { name: "Cột dài" } });
  const { id, boardId } = (await created.json()) as { id: string; boardId: string };
  const board = (await (await page.request.get(`/api/v1/boards/${boardId}`)).json()) as Board;
  const [todo, doing] = board.columns;
  // Sequential: the creation order is the column order (Thẻ 001…250).
  for (let n = 1; n <= COUNT; n += 1) {
    const res = await page.request.post("/api/v1/tasks", {
      data: { title: pad(n), columnId: todo.id },
    });
    expect(res.ok()).toBe(true);
  }
  for (const title of ["Mới dưới", "Mới giữa", "Mới cuối"]) {
    await page.request.post("/api/v1/tasks", { data: { title, columnId: doing.id } });
  }
  return { id, boardId };
}

const column = (page: Page, name: string) =>
  page.getByRole("region", { name: new RegExp(`^${name}`) });
const card = (scope: Locator, title: string) =>
  scope.getByRole("button", { name: new RegExp(`^Việc: ${title},`) });

async function serverOrder(page: Page, boardId: string) {
  const board = (await (await page.request.get(`/api/v1/boards/${boardId}`)).json()) as Board;
  return board.columns.find((c) => c.name === "Cần làm")?.tasks.map((t) => t.title) ?? [];
}

async function domOrder(scope: Locator) {
  const labels = await scope
    .getByRole("button", { name: /^Việc: / })
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
  return labels.map((label) => label.replace(/^Việc: /, "").split(",")[0]);
}

/**
 * Scrolls the column so the gap below `upper` sits in the middle of the visible list, away
 * from dnd-kit's auto-scroll zones at the edges, and returns that point.
 */
async function centerGapBelow(upper: Locator) {
  await upper.evaluate((el) => {
    const li = el.closest("li") as HTMLElement;
    const ul = li.parentElement as HTMLElement;
    ul.scrollIntoView({ block: "nearest" });
    const gap = li.getBoundingClientRect().bottom;
    const box = ul.getBoundingClientRect();
    ul.scrollTop += gap - (box.top + ul.clientHeight / 2);
  });
  const box = await upper.boundingBox();
  if (!box) throw new Error("card not visible");
  return { x: box.x + box.width / 2, y: box.y + box.height + 4 };
}

/** Pointer drag with intermediate moves (dnd-kit's PointerSensor needs ≥ 5 px). */
async function dragTo(page: Page, title: string, to: { x: number; y: number }) {
  const from = await card(column(page, "Đang làm"), title).boundingBox();
  if (!from) throw new Error("source not visible");
  const moved = page.waitForResponse((r) => r.url().includes("/move") && r.ok());
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 25 });
  await page.mouse.up();
  await moved;
}

function expectBetween(titles: string[], title: string, before: string, after: string) {
  const at = titles.indexOf(title);
  expect(titles.slice(at - 1, at + 2)).toEqual([before, title, after]);
}

test("drops land exactly where aimed in a scrolled 250-card column", async ({ page }) => {
  test.setTimeout(150_000);
  await registerNewUser(page);
  const { id, boardId } = await seedLongColumn(page);
  await page.goto(`/projects/${id}?view=kanban`);
  const todo = column(page, "Cần làm");
  const list = todo.getByRole("list");
  await expect(card(todo, pad(COUNT))).toHaveCount(1);

  // 1. Scrolled to the bottom: between two cards that are visible there.
  await list.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await dragTo(page, "Mới dưới", await centerGapBelow(card(todo, pad(247))));
  expectBetween(await serverOrder(page, boardId), "Mới dưới", pad(247), pad(248));

  // 2. The middle of the column (cards there were off-screen, i.e. skipped, until now).
  await dragTo(page, "Mới giữa", await centerGapBelow(card(todo, pad(125))));
  expectBetween(await serverOrder(page, boardId), "Mới giữa", pad(125), pad(126));

  // 3. The end of the column: below the last card.
  await list.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await card(todo, pad(COUNT)).scrollIntoViewIfNeeded();
  const last = await card(todo, pad(COUNT)).boundingBox();
  if (!last) throw new Error("last card not visible");
  await dragTo(page, "Mới cuối", { x: last.x + last.width / 2, y: last.y + last.height + 20 });

  const titles = await serverOrder(page, boardId);
  expect(titles).toHaveLength(COUNT + 3);
  expect(titles.at(-1)).toBe("Mới cuối");
  expectBetween(titles, "Mới dưới", pad(247), pad(248));
  expectBetween(titles, "Mới giữa", pad(125), pad(126));
  expect(await domOrder(todo)).toEqual(titles);

  await page.reload();
  await expect(card(column(page, "Cần làm"), "Mới cuối")).toHaveCount(1);
  expect(await domOrder(column(page, "Cần làm"))).toEqual(titles);
});
