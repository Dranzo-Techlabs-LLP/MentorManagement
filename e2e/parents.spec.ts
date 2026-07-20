import { test, expect, type Page } from "@playwright/test";
import { E2E_PREFIX, uniqueName, uniqueEmail, toast, confirmDelete, tableRow } from "./helpers";

/**
 * E2E coverage for the Parents screen (admin/parents).
 *
 * Safety: every mutating test creates its own uniquely-named parent
 * (E2E_PREFIX) and removes it afterwards. No test touches a pre-existing
 * seed parent.
 */

function parentRow(page: Page, name: string) {
  return tableRow(page, name);
}

async function createParent(page: Page, name: string, email: string) {
  await page.getByRole("button", { name: "Add Parent", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Full name").fill(name);
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  await dialog.getByRole("button", { name: /^create parent$/i }).click();
  await expect(dialog).toBeHidden();
  await expect(parentRow(page, name)).toBeVisible();
}

async function deleteParentIfExists(page: Page, name: string) {
  await page.goto("/admin/parents");
  const row = parentRow(page, name);
  if ((await row.count()) === 0) return;
  await confirmDelete(page, row.getByRole("button", { name: /^delete$/i }));
}

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await page.goto("/admin/parents");
    const leftovers = page.getByRole("row", { name: new RegExp(`^${E2E_PREFIX}`) });
    for (let i = await leftovers.count(); i > 0; i--) {
      const row = leftovers.first();
      if ((await row.count()) === 0) break;
      await confirmDelete(page, row.getByRole("button", { name: /^delete$/i }));
    }
  } catch {
    // best-effort cleanup — never fail the run here
  } finally {
    await page.close();
  }
});

test.beforeEach(async ({ page }) => {
  await page.goto("/admin/parents");
});

test("page loads with the parents list and table columns", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Parents", exact: true })).toBeVisible();
  for (const col of ["Parent", "Email", "Phone", "Children", "Status", "Actions"]) {
    await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
  }
});

test("creates a new parent, shows a success toast, and it appears in the list", async ({ page }) => {
  const name = uniqueName("parent-");
  const email = uniqueEmail("parent");
  try {
    await createParent(page, name, email);
    await expect(toast(page, /Parent created/i)).toBeVisible();

    const row = parentRow(page, name);
    await expect(row.getByText(email, { exact: true })).toBeVisible();

    await page.reload();
    await expect(parentRow(page, name)).toBeVisible();
  } finally {
    await deleteParentIfExists(page, name);
  }
});

test("rejects an empty name and an invalid email", async ({ page }) => {
  await page.getByRole("button", { name: "Add Parent", exact: true }).click();
  const dialog = page.getByRole("dialog");

  // Empty name — blocked by the required attribute.
  await dialog.getByLabel("Full name").fill("");
  await dialog.getByLabel("Email", { exact: true }).fill(uniqueEmail("parent"));
  await dialog.getByRole("button", { name: /^create parent$/i }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Full name")).toHaveJSProperty("validity.valueMissing", true);

  // Malformed email — the native type="email" input blocks submission client-side
  // before the server-side zod message ever gets a chance to render.
  await dialog.getByLabel("Full name").fill(uniqueName("parent-"));
  await dialog.getByLabel("Email", { exact: true }).fill("not-an-email");
  await dialog.getByRole("button", { name: /^create parent$/i }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Email", { exact: true })).toHaveJSProperty("validity.typeMismatch", true);

  await page.keyboard.press("Escape");
});

test("rejects a duplicate email with an inline error and creates no second account", async ({ page }) => {
  const name = uniqueName("parent-");
  const email = uniqueEmail("parent-dupe");
  try {
    await createParent(page, name, email);

    const secondName = uniqueName("parent-");
    await page.getByRole("button", { name: "Add Parent", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Full name").fill(secondName);
    await dialog.getByLabel("Email", { exact: true }).fill(email);
    await dialog.getByRole("button", { name: /^create parent$/i }).click();

    await expect(dialog.getByText(/already in use/i)).toBeVisible();
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await page.reload();
    await expect(parentRow(page, secondName)).toHaveCount(0);
  } finally {
    await deleteParentIfExists(page, name);
  }
});

test("edits a parent: name, email and phone persist after reload", async ({ page }) => {
  const name = uniqueName("parent-");
  const renamed = uniqueName("parent-renamed-");
  const email = uniqueEmail("parent");
  try {
    await createParent(page, name, email);

    await parentRow(page, name).getByRole("button", { name: /^edit$/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Full name").fill(renamed);
    await dialog.getByLabel("Phone").fill("+91 90000 00000");
    await dialog.getByRole("button", { name: /save changes/i }).click();
    await expect(dialog).toBeHidden();
    await expect(toast(page, /Parent updated/i)).toBeVisible();

    const row = parentRow(page, renamed);
    await expect(row).toBeVisible();
    await expect(row.getByText("+91 90000 00000", { exact: true })).toBeVisible();
    await expect(parentRow(page, name)).toHaveCount(0);

    await page.reload();
    const reloaded = parentRow(page, renamed);
    await expect(reloaded).toBeVisible();
    await expect(reloaded.getByText("+91 90000 00000", { exact: true })).toBeVisible();
  } finally {
    await deleteParentIfExists(page, renamed);
    await deleteParentIfExists(page, name);
  }
});

test("deletes a parent via the confirmation dialog", async ({ page }) => {
  const name = uniqueName("parent-");
  await createParent(page, name, uniqueEmail("parent"));

  await parentRow(page, name).getByRole("button", { name: /^delete$/i }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();

  await confirm.getByRole("button", { name: /cancel/i }).click();
  await expect(confirm).toBeHidden();
  await expect(parentRow(page, name)).toBeVisible();

  await parentRow(page, name).getByRole("button", { name: /^delete$/i }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /^delete$/i }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(toast(page, /Parent deleted/i)).toBeVisible();
  await expect(parentRow(page, name)).toHaveCount(0);

  await page.reload();
  await expect(parentRow(page, name)).toHaveCount(0);
});
