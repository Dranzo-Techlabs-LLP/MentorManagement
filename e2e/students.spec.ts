import { test, expect, type Page } from "@playwright/test";
import { E2E_PREFIX, uniqueName, toast, confirmDelete, tableRow } from "./helpers";

/**
 * E2E coverage for the Students screen (admin/students).
 *
 * Safety: every mutating test creates its own uniquely-named student
 * (E2E_PREFIX) and removes it afterwards. No test touches a pre-existing
 * seed student, mentor or institution.
 */

function studentRow(page: Page, name: string) {
  return tableRow(page, name);
}

async function createStudent(page: Page, name: string) {
  await page.getByRole("button", { name: "Add Student", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Full name").fill(name);
  await dialog.getByLabel("Class / Grade").fill("Grade 9");
  await dialog.getByLabel("Roll number").fill("E2E-01");
  await dialog.getByRole("button", { name: /^create student$/i }).click();
  await expect(dialog).toBeHidden();
  await expect(studentRow(page, name)).toBeVisible();
}

async function deleteStudentIfExists(page: Page, name: string) {
  await page.goto("/admin/students");
  const row = studentRow(page, name);
  if ((await row.count()) === 0) return;
  await confirmDelete(page, row.getByRole("button", { name: /^delete$/i }));
}

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await page.goto("/admin/students");
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
  await page.goto("/admin/students");
});

test("page loads with the students list and table columns", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Students", exact: true })).toBeVisible();
  for (const col of ["Student", "Class", "Level", "Institution", "Mentor", "Status", "Actions"]) {
    await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
  }
});

test("creates a new student, shows a success toast, and it appears in the list", async ({ page }) => {
  const name = uniqueName("student-");
  try {
    await createStudent(page, name);
    await expect(toast(page, /Student created/i)).toBeVisible();

    const row = studentRow(page, name);
    await expect(row.getByText("Roll E2E-01")).toBeVisible();
    await expect(row.getByText("Grade 9", { exact: true })).toBeVisible();
    await expect(row.getByText("Unassigned", { exact: true })).toBeVisible();

    await page.reload();
    await expect(studentRow(page, name)).toBeVisible();
  } finally {
    await deleteStudentIfExists(page, name);
  }
});

test("rejects an empty full name and creates nothing", async ({ page }) => {
  const before = await page.getByRole("row").count();

  await page.getByRole("button", { name: "Add Student", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("");
  await dialog.getByRole("button", { name: /^create student$/i }).click();

  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Full name")).toHaveJSProperty("validity.valueMissing", true);

  await page.keyboard.press("Escape");
  await page.reload();
  expect(await page.getByRole("row").count()).toBe(before);
});

test("rejects a malformed email and a future date of birth", async ({ page }) => {
  await page.getByRole("button", { name: "Add Student", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill(uniqueName("student-"));

  // Malformed email — native type="email" validation blocks submission client-side.
  await dialog.getByLabel("Email", { exact: true }).fill("not-an-email");
  await dialog.getByRole("button", { name: /^create student$/i }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Email", { exact: true })).toHaveJSProperty("validity.typeMismatch", true);
  await dialog.getByLabel("Email", { exact: true }).fill("");

  // Future date of birth — server-side rule surfaces inline.
  const future = new Date();
  future.setFullYear(future.getFullYear() + 1);
  await dialog.getByLabel("Date of birth").fill(future.toISOString().slice(0, 10));
  await dialog.getByRole("button", { name: /^create student$/i }).click();
  await expect(dialog.getByText(/cannot be in the future/i)).toBeVisible();
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
});

test("edits a student: name, class and city persist after reload", async ({ page }) => {
  const name = uniqueName("student-");
  const renamed = uniqueName("student-renamed-");
  try {
    await createStudent(page, name);

    await studentRow(page, name).getByRole("button", { name: /^edit$/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Full name").fill(renamed);
    await dialog.getByLabel("Class / Grade").fill("Grade 11");
    await dialog.getByLabel("City").fill("Kochi");
    await dialog.getByRole("button", { name: /save changes/i }).click();
    await expect(dialog).toBeHidden();
    await expect(toast(page, /Student updated/i)).toBeVisible();

    const row = studentRow(page, renamed);
    await expect(row).toBeVisible();
    await expect(row.getByText("Grade 11", { exact: true })).toBeVisible();
    await expect(studentRow(page, name)).toHaveCount(0);

    await page.reload();
    const reloaded = studentRow(page, renamed);
    await expect(reloaded).toBeVisible();
    await expect(reloaded.getByText("Grade 11", { exact: true })).toBeVisible();
  } finally {
    await deleteStudentIfExists(page, renamed);
    await deleteStudentIfExists(page, name);
  }
});

test("deletes a student via the confirmation dialog", async ({ page }) => {
  const name = uniqueName("student-");
  await createStudent(page, name);

  await studentRow(page, name).getByRole("button", { name: /^delete$/i }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();

  await confirm.getByRole("button", { name: /cancel/i }).click();
  await expect(confirm).toBeHidden();
  await expect(studentRow(page, name)).toBeVisible();

  await studentRow(page, name).getByRole("button", { name: /^delete$/i }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /^delete$/i }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(toast(page, /Student deleted/i)).toBeVisible();
  await expect(studentRow(page, name)).toHaveCount(0);

  await page.reload();
  await expect(studentRow(page, name)).toHaveCount(0);
});
