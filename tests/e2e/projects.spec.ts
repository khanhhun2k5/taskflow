import { expect, test, type Page } from "@playwright/test";
import { registerNewUser } from "./helpers";

// MVP-1 c1 main flow: project → tasks → TaskDialog edits survive a reload → trash → restore.

async function waitSaved(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Chi tiết việc" });
  await expect(dialog.getByRole("status").filter({ hasText: "Đã lưu" })).toBeVisible();
}

test("create a project, edit a task in TaskDialog, reload, delete and restore it", async ({
  page,
}) => {
  await registerNewUser(page);

  // Create the project from /projects.
  await page.goto("/projects");
  await page.getByRole("button", { name: "Dự án mới" }).first().click();
  const create = page.getByRole("dialog", { name: "Tạo dự án" });
  await create.getByLabel("Tên dự án").fill("Website cá nhân");
  await create.getByRole("radio", { name: "Xanh lá" }).click();
  await create.getByRole("button", { name: "Tạo dự án" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/?]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Website cá nhân" })).toBeVisible();
  const projectUrl = page.url();

  // Three tasks with QuickAdd: they land in the first TODO column (BR-27).
  const quickAdd = page.getByRole("textbox", { name: "Thêm việc mới" });
  for (const title of ["Thiết kế", "Viết nội dung", "Triển khai"]) {
    await quickAdd.fill(title);
    await quickAdd.press("Enter");
    await expect(quickAdd).toBeFocused();
  }
  const todo = page.getByRole("region", { name: /^Cần làm/ });
  for (const title of ["Thiết kế", "Viết nội dung", "Triển khai"]) {
    await expect(todo.getByRole("button", { name: new RegExp(title) })).toBeEnabled();
  }

  // TaskDialog: title, a new label, a subtask.
  await todo.getByRole("button", { name: /Thiết kế/ }).click();
  const dialog = page.getByRole("dialog", { name: "Chi tiết việc" });
  const title = dialog.getByRole("textbox", { name: "Tiêu đề" });
  await title.fill("Thiết kế giao diện");
  await waitSaved(page);

  await dialog.getByRole("button", { name: "Chọn nhãn" }).click();
  const newLabel = page.getByRole("textbox", { name: "Tên nhãn mới" });
  await newLabel.fill("Gấp");
  await newLabel.press("Enter");
  await expect(dialog.getByRole("list", { name: "Nhãn" })).toContainText("Gấp");
  await waitSaved(page);
  await page.keyboard.press("Escape"); // closes the label popover only
  await expect(dialog).toBeVisible();

  const subtaskInput = dialog.getByRole("textbox", { name: "Thêm việc con" });
  await subtaskInput.fill("Vẽ wireframe");
  await subtaskInput.press("Enter");
  await expect(dialog.getByRole("button", { name: /Vẽ wireframe/ })).toBeEnabled();

  // The dialog lives in the URL (?task=), so a reload reopens it with the saved data.
  await page.reload();
  const reopened = page.getByRole("dialog", { name: "Chi tiết việc" });
  await expect(reopened.getByRole("textbox", { name: "Tiêu đề" })).toHaveValue(
    "Thiết kế giao diện",
  );
  await expect(reopened.getByRole("list", { name: "Nhãn" })).toContainText("Gấp");
  await expect(reopened.getByRole("button", { name: /Vẽ wireframe/ })).toBeVisible();

  // Delete → trash → restore → back on the board.
  await reopened.getByRole("button", { name: "Xóa việc" }).click();
  await expect(reopened).toBeHidden();
  await expect(todo.getByRole("button", { name: /Thiết kế giao diện/ })).toHaveCount(0);

  await page.goto("/trash");
  await page.getByRole("button", { name: "Khôi phục Thiết kế giao diện" }).click();
  await expect(page.getByText("Đã khôi phục “Thiết kế giao diện”.")).toBeVisible();

  await page.goto(projectUrl);
  await expect(
    page
      .getByRole("region", { name: /^Cần làm/ })
      .getByRole("button", { name: /Thiết kế giao diện/ }),
  ).toBeVisible();
});
