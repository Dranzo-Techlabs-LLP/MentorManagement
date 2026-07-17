import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/admin.json");

/**
 * Logs in once as Super Admin and persists the session cookie, so specs start
 * authenticated instead of re-logging in for every test.
 *
 * The login form's inputs aren't label-associated, so we locate by placeholder
 * (a user-visible attribute) rather than a brittle CSS selector.
 */
setup("authenticate as super admin", async ({ page }) => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set — copy .env.example to .env and fill them in.");
  }

  await page.goto("/login");
  await page.getByPlaceholder("you@ndhrglobal.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // A Super Admin lands on /admin; anything else means the credentials are wrong
  // or the account lacks Super Admin.
  await page.waitForURL(/\/admin(\/|$)/, { timeout: 20_000 });

  // Confirm the session actually grants the Roles screen before saving state.
  await page.goto("/admin/roles");
  await expect(page.getByRole("heading", { name: "Roles & Responsibilities" })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
