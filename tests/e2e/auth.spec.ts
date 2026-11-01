import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations, registerNewUser } from "./helpers";

// TC-90 (P0 part): sign up → land on Today. Quick add is covered in MVP-1.
test("TC-90 sign up lands on the empty Today page", async ({ page }) => {
  await registerNewUser(page);

  await expect(page.getByRole("heading", { level: 1, name: "Hôm nay" })).toBeVisible();
  await expect(page.getByText("Hôm nay bạn rảnh!")).toBeVisible();
  await expect(page.getByText("Thêm việc hoặc xem lịch tuần.")).toBeVisible();
  // Disabled actions announce that they are not available yet.
  await expect(
    page.getByRole("button", { name: "Thêm việc (Sắp có)", exact: true }),
  ).toBeDisabled();
  await expectNoSeriousA11yViolations(page);
});

test("signed-out visitors are sent to /login", async ({ page }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1, name: "Đăng nhập" })).toBeVisible();
});

test("phone layout uses the bottom navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await registerNewUser(page);

  const bottomNav = page.getByRole("navigation", { name: "Điều hướng chính" });
  await expect(bottomNav).toHaveCount(1); // the sidebar is hidden below 768px
  await expect(bottomNav.getByRole("link", { name: "Hôm nay" })).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});

test("tablet layout shows the icon-only sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1024 });
  await registerNewUser(page);

  const sidebarNav = page.getByRole("navigation", { name: "Điều hướng chính" });
  await expect(sidebarNav).toHaveCount(1); // bottom nav is hidden from 768px
  const today = sidebarNav.getByRole("link", { name: "Hôm nay" });
  await expect(today).toBeVisible(); // label is sr-only but still the accessible name
  await expect(sidebarNav.getByText("Chưa có môn học")).toBeHidden();
  await expectNoSeriousA11yViolations(page);
});

// NFR-41: the UI language follows User.locale.
test("switching User.locale to en renders the app in English", async ({ page }) => {
  await registerNewUser(page);
  const response = await page.request.patch("/api/v1/me", { data: { locale: "en" } });
  expect(response.ok()).toBe(true);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
  await expect(page.getByText("You're free today!")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expectNoSeriousA11yViolations(page);
});

// US-02: without GOOGLE_CLIENT_ID/SECRET (as in CI) the Google button is hidden.
test("Google sign-in is hidden when not configured", async ({ page }) => {
  test.skip(
    Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    "Google is configured in this environment",
  );
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tiếp tục với Google" })).toHaveCount(0);
  await expect(page.getByText("hoặc", { exact: true })).toHaveCount(0);
});
