import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousA11yViolations, registerNewUser } from "./helpers";

/** Some data so the pages show their "has data" state; returns the project id. */
async function seedData(page: Page): Promise<string> {
  const project = await page.request.post("/api/v1/projects", { data: { name: "Dự án A11y" } });
  expect(project.ok()).toBe(true);
  const { id } = (await project.json()) as { id: string };
  await page.request.post("/api/v1/tasks", { data: { title: "Việc trong dự án", projectId: id } });
  await page.request.post("/api/v1/tasks", {
    data: { title: "Việc trễ hạn", dueAt: "2020-01-01T00:00:00.000Z" },
  });
  const trashed = await page.request.post("/api/v1/tasks", { data: { title: "Việc đã xóa" } });
  const { id: trashedId } = (await trashed.json()) as { id: string };
  await page.request.delete(`/api/v1/tasks/${trashedId}`);
  return id;
}

// docs/09 section 5 + NFR-22: check both color schemes.
for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`accessibility (${colorScheme})`, () => {
    test.use({ colorScheme });

    test("/login has no serious axe violations", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByRole("heading", { level: 1, name: "Đăng nhập" })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    test("/today has no serious axe violations", async ({ page }) => {
      await registerNewUser(page);
      await expect(page.getByRole("heading", { level: 1, name: "Hôm nay" })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    test("MVP-1 pages have no serious axe violations", async ({ page }) => {
      await registerNewUser(page);
      const projectId = await seedData(page);
      const pages = [
        { path: "/inbox", heading: "Hộp thư", ready: "Việc trễ hạn" },
        { path: "/projects", heading: "Dự án", ready: "Dự án A11y" },
        { path: `/projects/${projectId}`, heading: "Dự án A11y", ready: "Việc trong dự án" },
        { path: "/trash", heading: "Thùng rác", ready: "Việc đã xóa" },
      ];
      for (const { path, heading, ready } of pages) {
        await test.step(path, async () => {
          await page.goto(path);
          await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
          await expect(page.getByText(ready).first()).toBeVisible();
          await expectNoSeriousA11yViolations(page);
        });
      }
    });

    test("TaskDialog has no serious axe violations", async ({ page }) => {
      await registerNewUser(page);
      await seedData(page);
      await page.goto("/inbox");
      await page.getByRole("button", { name: /Việc trễ hạn/ }).click();
      const dialog = page.getByRole("dialog", { name: "Chi tiết việc" });
      await expect(dialog.getByRole("textbox", { name: "Tiêu đề" })).toHaveValue("Việc trễ hạn");
      await expectNoSeriousA11yViolations(page);
    });
  });
}
