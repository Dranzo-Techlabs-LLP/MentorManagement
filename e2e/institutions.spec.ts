import { test, expect, type Page } from "@playwright/test";
import { E2E_PREFIX, uniqueName, toast, confirmDelete, tableRow } from "./helpers";

/**
 * E2E coverage for the Institutions screen (admin/institutions).
 *
 * Safety: every mutating test creates its own uniquely-named institution
 * (E2E_PREFIX) and removes it afterwards. No test touches a pre-existing
 * seed institution, so this suite is safe to run against a live environment.
 */

/** An institution's table row, scoped by exact name. */
function institutionRow(page: Page, name: string) {
  return tableRow(page, name);
}

async function createInstitution(page: Page, name: string, type = "Mahall") {
  await page.getByRole("button", { name: "Add Institution", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByLabel("Type").selectOption({ label: type });
  await dialog.getByRole("button", { name: /^create institution$/i }).click();
  await expect(dialog).toBeHidden();
  await expect(institutionRow(page, name)).toBeVisible();
}

async function deleteInstitutionIfExists(page: Page, name: string) {
  await page.goto("/admin/institutions");
  const row = institutionRow(page, name);
  if ((await row.count()) === 0) return;
  await confirmDelete(page, row.getByRole("button", { name: /^delete$/i }));
}

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await page.goto("/admin/institutions");
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
  await page.goto("/admin/institutions");
});

test("page loads with the institutions list and table columns", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Institutions" })).toBeVisible();
  for (const col of ["Institution", "Type", "City", "Contact", "Students", "Users", "Actions"]) {
    await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
  }
});

test("creates a new institution, shows a success toast, and it appears in the list", async ({ page }) => {
  const name = uniqueName("inst-");
  try {
    await createInstitution(page, name, "Mahall");
    await expect(toast(page, /Institution created/i)).toBeVisible();

    const row = institutionRow(page, name);
    await expect(row.getByText("Mahall", { exact: true })).toBeVisible();

    await page.reload();
    await expect(institutionRow(page, name)).toBeVisible();
  } finally {
    await deleteInstitutionIfExists(page, name);
  }
});

test("rejects an empty institution name and creates nothing", async ({ page }) => {
  const before = await page.getByRole("row").count();

  await page.getByRole("button", { name: "Add Institution", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("");
  await dialog.getByRole("button", { name: /^create institution$/i }).click();

  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Name", { exact: true })).toHaveJSProperty("validity.valueMissing", true);

  await page.keyboard.press("Escape");
  await page.reload();
  expect(await page.getByRole("row").count()).toBe(before);
});

test("edits an institution: rename and field changes persist after reload", async ({ page }) => {
  const name = uniqueName("inst-");
  const renamed = `${name}-renamed`;
  try {
    await createInstitution(page, name, "School");

    await institutionRow(page, name).getByRole("button", { name: /^edit$/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Name", { exact: true }).fill(renamed);
    await dialog.getByLabel("City").fill("Kozhikode");
    await dialog.getByLabel("Type").selectOption({ label: "College" });
    await dialog.getByRole("button", { name: /save changes/i }).click();
    await expect(dialog).toBeHidden();
    await expect(toast(page, /Institution updated/i)).toBeVisible();

    const row = institutionRow(page, renamed);
    await expect(row).toBeVisible();
    await expect(row.getByText("Kozhikode", { exact: true })).toBeVisible();
    await expect(row.getByText("College", { exact: true })).toBeVisible();
    await expect(institutionRow(page, name)).toHaveCount(0);

    await page.reload();
    const reloaded = institutionRow(page, renamed);
    await expect(reloaded).toBeVisible();
    await expect(reloaded.getByText("Kozhikode", { exact: true })).toBeVisible();
  } finally {
    await deleteInstitutionIfExists(page, renamed);
    await deleteInstitutionIfExists(page, name);
  }
});

test("deletes an institution via the confirmation dialog", async ({ page }) => {
  const name = uniqueName("inst-");
  await createInstitution(page, name);

  await institutionRow(page, name).getByRole("button", { name: /^delete$/i }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();

  // Cancelling leaves it intact.
  await confirm.getByRole("button", { name: /cancel/i }).click();
  await expect(confirm).toBeHidden();
  await expect(institutionRow(page, name)).toBeVisible();

  // Confirming removes it.
  await institutionRow(page, name).getByRole("button", { name: /^delete$/i }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /^delete$/i }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(toast(page, /Institution deleted/i)).toBeVisible();
  await expect(institutionRow(page, name)).toHaveCount(0);

  await page.reload();
  await expect(institutionRow(page, name)).toHaveCount(0);
});
