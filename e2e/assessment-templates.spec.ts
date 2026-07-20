import { test, expect, type Page } from "@playwright/test";
import { E2E_PREFIX, uniqueName, toast, confirmDelete, tableRow } from "./helpers";

/**
 * E2E coverage for the Assessment Templates panel (admin/assessments).
 *
 * Safety: every mutating test creates its own uniquely-titled template
 * (E2E_PREFIX) and removes it afterwards. No test touches a pre-existing
 * seed template, and none assign the template to a real student (which
 * would block deletion) — that flow lives outside this admin screen.
 */

const VALID_QUESTIONS = JSON.stringify([
  { id: "q1", text: "I enjoy solving puzzles", options: [{ label: "Strongly agree", value: 5, score: 5, trait: "logical" }] },
]);

function templateRow(page: Page, title: string) {
  return tableRow(page, title);
}

async function createTemplate(page: Page, title: string) {
  await page.getByRole("button", { name: "Add Template", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Title", { exact: true }).fill(title);
  await dialog.getByLabel("Category", { exact: true }).selectOption({ label: "Leadership" });
  await dialog.getByLabel("Level", { exact: true }).selectOption({ label: "Level 2" });
  await dialog.getByLabel("Duration (mins)").fill("20");
  await dialog.getByLabel(/^Questions/).fill(VALID_QUESTIONS);
  await dialog.getByRole("button", { name: /^create template$/i }).click();
  await expect(dialog).toBeHidden();
  await expect(templateRow(page, title)).toBeVisible();
}

async function deleteTemplateIfExists(page: Page, title: string) {
  await page.goto("/admin/assessments");
  const row = templateRow(page, title);
  if ((await row.count()) === 0) return;
  await confirmDelete(page, row.getByRole("button", { name: /^delete$/i }));
}

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await page.goto("/admin/assessments");
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
  await page.goto("/admin/assessments");
});

test("page loads with the assessment templates table", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Assessment Framework", exact: true })).toBeVisible();

  // Scoped to the Templates panel — "Category" also appears in the separate
  // "Recent Completed Assessments" table below it.
  const panel = page.locator(".card").filter({ has: page.getByRole("heading", { name: "Assessment Templates", exact: true }) });
  await expect(panel).toBeVisible();
  for (const col of ["Title", "Level", "Category", "Age range", "Duration", "Instances", "Actions"]) {
    await expect(panel.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
  }
});

test("creates a new template, shows a success toast, and it appears in the list", async ({ page }) => {
  const title = uniqueName("tmpl-");
  try {
    await createTemplate(page, title);
    await expect(toast(page, /Template created/i)).toBeVisible();

    const row = templateRow(page, title);
    await expect(row.getByText("Leadership", { exact: true })).toBeVisible();
    await expect(row.getByText(/Level 2/)).toBeVisible();
    await expect(row.getByText("20 min", { exact: true })).toBeVisible();

    await page.reload();
    await expect(templateRow(page, title)).toBeVisible();
  } finally {
    await deleteTemplateIfExists(page, title);
  }
});

test("rejects an empty title and invalid questions JSON", async ({ page }) => {
  await page.getByRole("button", { name: "Add Template", exact: true }).click();
  const dialog = page.getByRole("dialog");

  // Empty title — blocked by the required attribute.
  await dialog.getByLabel("Title", { exact: true }).fill("");
  await dialog.getByRole("button", { name: /^create template$/i }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveJSProperty("validity.valueMissing", true);

  // Malformed questions JSON — server-side error surfaces inline.
  await dialog.getByLabel("Title", { exact: true }).fill(uniqueName("tmpl-"));
  await dialog.getByLabel(/^Questions/).fill("{ not valid json");
  await dialog.getByRole("button", { name: /^create template$/i }).click();
  await expect(dialog.getByText(/valid JSON array/i)).toBeVisible();
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
});

test("edits a template: title, category and duration persist after reload", async ({ page }) => {
  const title = uniqueName("tmpl-");
  const renamed = uniqueName("tmpl-renamed-");
  try {
    await createTemplate(page, title);

    await templateRow(page, title).getByRole("button", { name: /^edit$/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Title", { exact: true }).fill(renamed);
    await dialog.getByLabel("Category", { exact: true }).selectOption({ label: "Strength" });
    await dialog.getByLabel("Duration (mins)").fill("35");
    await dialog.getByRole("button", { name: /save changes/i }).click();
    await expect(dialog).toBeHidden();
    await expect(toast(page, /Template updated/i)).toBeVisible();

    const row = templateRow(page, renamed);
    await expect(row).toBeVisible();
    await expect(row.getByText("Strength", { exact: true })).toBeVisible();
    await expect(row.getByText("35 min", { exact: true })).toBeVisible();
    await expect(templateRow(page, title)).toHaveCount(0);

    await page.reload();
    const reloaded = templateRow(page, renamed);
    await expect(reloaded).toBeVisible();
    await expect(reloaded.getByText("35 min", { exact: true })).toBeVisible();
  } finally {
    await deleteTemplateIfExists(page, renamed);
    await deleteTemplateIfExists(page, title);
  }
});

test("deactivating and reactivating a template updates its status", async ({ page }) => {
  const title = uniqueName("tmpl-");
  try {
    await createTemplate(page, title);
    const row = templateRow(page, title);

    await row.getByRole("button", { name: /deactivate/i }).click();
    await expect(row.getByText("Inactive", { exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: /activate/i })).toBeVisible();

    await row.getByRole("button", { name: /^activate$/i }).click();
    await expect(row.getByText("Inactive", { exact: true })).toHaveCount(0);
    await expect(row.getByRole("button", { name: /deactivate/i })).toBeVisible();
  } finally {
    await deleteTemplateIfExists(page, title);
  }
});

test("deletes a template via the confirmation dialog", async ({ page }) => {
  const title = uniqueName("tmpl-");
  await createTemplate(page, title);

  await templateRow(page, title).getByRole("button", { name: /^delete$/i }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();

  await confirm.getByRole("button", { name: /cancel/i }).click();
  await expect(confirm).toBeHidden();
  await expect(templateRow(page, title)).toBeVisible();

  await templateRow(page, title).getByRole("button", { name: /^delete$/i }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /^delete$/i }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(toast(page, /Template deleted/i)).toBeVisible();
  await expect(templateRow(page, title)).toHaveCount(0);

  await page.reload();
  await expect(templateRow(page, title)).toHaveCount(0);
});
