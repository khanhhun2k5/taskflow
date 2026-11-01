import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { randomInt, randomUUID } from "node:crypto";

/** Registers a fresh account through the UI and waits for the Today page (US-01). */
export async function registerNewUser(page: Page) {
  const email = `e2e-${randomUUID()}@example.test`;
  // Better Auth rate-limits sign-up per IP (NFR-11). On localhost every request shares one
  // bucket, so each test gets its own client IP through the trusted x-forwarded-for header.
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
  });
  await page.goto("/register");
  await page.getByLabel("Tên").fill("Người Thử");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL(/\/today$/);
  return { email };
}

/** docs/09 section 5: fail on axe violations of impact "serious" or worse. */
export async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target) }));
  expect(blocking).toEqual([]);
}
