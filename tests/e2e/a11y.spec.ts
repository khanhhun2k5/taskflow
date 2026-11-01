import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations, registerNewUser } from "./helpers";

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
  });
}
