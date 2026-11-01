import { expect, test, type Locator, type Page } from "@playwright/test";
import { registerNewUser } from "./helpers";

// MVP-1 c2: Kanban drag and drop (TC-91, TC-92), ListView bulk edit and URL filters.

async function createProjectWithTasks(page: Page, name: string, titles: string[]) {
  const response = await page.request.post("/api/v1/projects", { data: { name } });
  expect(response.ok()).toBe(true);
  const { id } = (await response.json()) as { id: string };
  await page.goto(`/projects/${id}?view=kanban`);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const quickAdd = page.getByRole("textbox", { name: "Thêm việc mới" });
  for (const title of titles) {
    await quickAdd.fill(title);
    await quickAdd.press("Enter");
  }
  // Saved (no longer an optimistic temp card) before the test drags it.
  for (const title of titles) {
    await expect(card(column(page, "Cần làm"), title)).not.toHaveAttribute("aria-disabled", "true");
  }
  return id;
}

/** The /move response, so a reload does not abort the request (the UI is optimistic). */
const waitForMove = (page: Page) =>
  page.waitForResponse(
    (r) => r.url().includes("/move") && r.request().method() === "POST" && r.ok(),
  );

const column = (page: Page, name: string) =>
  page.getByRole("region", { name: new RegExp(`^${name}`) });
const card = (scope: Locator, title: string) =>
  scope.getByRole("button", { name: new RegExp(`^Việc: ${title}`) });

/** Pointer drag with intermediate moves, as dnd-kit's PointerSensor needs (≥ 5 px). */
async function dragWithMouse(page: Page, from: Locator, to: Locator) {
  const source = await from.boundingBox();
  const target = await to.boundingBox();
  if (!source || !target) throw new Error("Element not visible");
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 10, source.y + source.height / 2, {
    steps: 5,
  });
  await page.mouse.move(target.x + target.width / 2, target.y + 40, { steps: 15 });
  await page.mouse.up();
}

test("TC-91: drag a task to Done → progress 33%, still right after a reload", async ({ page }) => {
  await registerNewUser(page);
  await createProjectWithTasks(page, "Dự án TC-91", ["Việc một", "Việc hai", "Việc ba"]);

  const moved = waitForMove(page);
  await dragWithMouse(page, card(column(page, "Cần làm"), "Việc hai"), column(page, "Xong"));
  await expect(card(column(page, "Xong"), "Việc hai")).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
  await expect(page.getByText("33%")).toBeVisible();

  await moved; // the reload must not cancel the /move request
  await page.reload();
  await expect(card(column(page, "Xong"), "Việc hai")).toBeVisible();
  await expect(card(column(page, "Cần làm"), "Việc hai")).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
});

test("TC-92: keyboard drag — Space, ArrowRight, Space moves the task to the next column", async ({
  page,
}) => {
  await registerNewUser(page);
  await createProjectWithTasks(page, "Dự án TC-92", ["Viết báo cáo", "Đọc tài liệu"]);

  await card(column(page, "Cần làm"), "Viết báo cáo").focus();
  await page.keyboard.press("Space");
  const live = page.locator('[id^="DndLiveRegion"]');
  await expect(live).toContainText("Đã nhặt Viết báo cáo. Đang ở cột Cần làm");
  // dnd-kit's KeyboardSensor starts listening in a setTimeout after pick-up; under parallel
  // test load a key sent right away can be lost. Re-sending is safe: a lost key leaves the
  // card where it was, so the next ArrowRight still means "one column to the right".
  await expect(async () => {
    await page.keyboard.press("ArrowRight");
    await expect(live).toContainText("đang ở cột Đang làm", { timeout: 1000 });
  }).toPass({ timeout: 8000 });
  const moved = waitForMove(page);
  await page.keyboard.press("Space");
  await expect(live).toContainText("Đã thả Viết báo cáo vào cột Đang làm");
  await expect(card(column(page, "Đang làm"), "Viết báo cáo")).toBeVisible();

  await moved; // the reload must not cancel the /move request
  await page.reload();
  await expect(card(column(page, "Đang làm"), "Viết báo cáo")).toBeVisible();
});

test("ListView: bulk-edit 3 tasks, and filters in the URL survive a reload", async ({ page }) => {
  await registerNewUser(page);
  await createProjectWithTasks(page, "Dự án danh sách", ["Một", "Hai", "Ba", "Bốn"]);
  await page.getByRole("tab", { name: "Danh sách" }).click();
  await expect(page).toHaveURL(/view=list/);

  const table = page.getByRole("table");
  for (const title of ["Một", "Hai", "Ba"]) {
    await table.getByRole("checkbox", { name: `Chọn ${title}` }).check();
  }
  const bar = page.getByRole("region", { name: "Thao tác hàng loạt" });
  await expect(bar.getByRole("status")).toHaveText("Đã chọn 3 việc");
  await bar.getByRole("combobox", { name: "Đổi ưu tiên" }).click();
  await page.getByRole("option", { name: "Cao" }).click();
  await expect(page.getByText("Đã cập nhật 3 việc.")).toBeVisible();
  const row = (title: string) =>
    table.getByRole("row").filter({ has: page.getByRole("button", { name: title, exact: true }) });
  for (const title of ["Một", "Hai", "Ba"]) await expect(row(title)).toContainText("Cao");
  await expect(row("Bốn")).toContainText("Trung bình");

  // Filter: priority High → only the 3 edited tasks; the URL keeps it across a reload.
  await page.getByRole("combobox", { name: "Ưu tiên", exact: true }).click();
  await page.getByRole("option", { name: "Cao" }).click();
  await expect(page).toHaveURL(/priority=HIGH/);
  await expect(table.getByRole("button", { name: "Bốn", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("tab", { name: "Danh sách" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("combobox", { name: "Ưu tiên", exact: true })).toHaveText("Cao");
  await expect(
    page.getByRole("table").getByRole("button", { name: "Một", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("table").getByRole("button", { name: "Bốn", exact: true }),
  ).toHaveCount(0);
});
