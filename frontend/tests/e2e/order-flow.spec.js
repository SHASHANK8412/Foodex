import { test, expect } from "@playwright/test";

test("basic order flow shell", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Foodex/i);

  await page.goto("/restaurants");
  await expect(page.locator("h1")).toContainText(/Restaurants/i);

  // This test is a scaffold for full login->checkout->tracking E2E.
  // Expand with seeded users and mocked payment callback in CI.
});
