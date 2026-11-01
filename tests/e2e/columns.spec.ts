import { expect, test, type Page } from "@playwright/test";
import { registerNewUser } from "./helpers";

// US-16 (rename, add, reorder columns) and US-17 (WIP limit, hard limit) through the UI.

const column = (page: Page, name: string) =>
  page.getByRole("region", { name: new RegExp(`^${name}`) });

async function openMenu(page: Page, name: string) {
  await page.getByRole("button", { name: `Thao tác với cột ${name}` }).click();
}

test("rename, add and reorder columns; a hard WIP limit blocks the drop", async ({ page }) => {
  test.setTimeout(60_000); // many UI steps
  await registerNewUser(page);
  const response = await page.request.post("/api/v1/projects", { data: { name: "Dự án cột" } });
  const { id } = (await response.json()) as { id: string };
  await page.request.post("/api/v1/tasks", { data: { title: "Việc A", projectId: id } });
  await page.request.post("/api/v1/tasks", { data: { title: "Việc B", projectId: id } });
  await page.goto(`/projects/${id}?view=kanban`);

  // Rename "Đang làm" → "Đang code".
  await openMenu(page, "Đang làm");
  await page.getByRole("menuitem", { name: "Đổi tên" }).click();
  const rename = page.getByRole("dialog", { name: "Đổi tên cột" });
  await rename.getByLabel("Tên cột").fill("Đang code");
  await rename.getByRole("button", { name: "Lưu" }).click();
  await expect(column(page, "Đang code")).toBeVisible();

  // Add "Review" to its right, then move it left of "Đang code".
  await openMenu(page, "Đang code");
  await page.getByRole("menuitem", { name: "Thêm cột bên phải" }).click();
  const add = page.getByRole("dialog", { name: "Thêm cột" });
  await add.getByLabel("Tên cột").fill("Review");
  await add.getByRole("button", { name: "Lưu" }).click();
  const names = () =>
    page.getByRole("tabpanel").getByRole("heading", { level: 2 }).allTextContents();
  await expect
    .poll(async () => (await names()).map((n) => n.split(/\d/)[0]))
    .toEqual(["Cần làm", "Đang code", "Review", "Xong"]);
  await openMenu(page, "Review");
  await page.getByRole("menuitem", { name: "Dời sang trái" }).click();
  await expect
    .poll(async () => (await names()).map((n) => n.split(/\d/)[0]))
    .toEqual(["Cần làm", "Review", "Đang code", "Xong"]);

  // WIP 1 with hard limit on "Xong": the first card fits, the second is blocked and rolled back.
  await openMenu(page, "Xong");
  await page.getByRole("menuitem", { name: "Đặt giới hạn WIP" }).click();
  const wip = page.getByRole("dialog", { name: "Giới hạn WIP" });
  await wip.getByLabel("Số việc tối đa").fill("1");
  await wip.getByLabel(/Chặn cứng/).click();
  await wip.getByRole("button", { name: "Lưu" }).click();
  await expect(column(page, "Xong")).toContainText("0/1");

  const moveToDone = async (title: string) => {
    await page.getByRole("button", { name: new RegExp(`^Việc: ${title}`) }).focus();
    await page.keyboard.press("Space");
    for (let i = 0; i < 3; i += 1) {
      await page.waitForTimeout(150);
      await page.keyboard.press("ArrowRight");
    }
    await page.waitForTimeout(150);
    await page.keyboard.press("Space");
  };
  await moveToDone("Việc A");
  await expect(column(page, "Xong").getByRole("button", { name: /^Việc: Việc A/ })).toBeVisible();
  await expect(column(page, "Xong")).toContainText("1/1");

  await moveToDone("Việc B");
  await expect(page.getByText("Cột đã đạt giới hạn số việc (WIP).")).toBeVisible();
  await expect(
    column(page, "Cần làm").getByRole("button", { name: /^Việc: Việc B/ }),
  ).toBeVisible();
  await expect(column(page, "Xong")).toContainText("1/1");
});
