import { test, expect, type Page } from "@playwright/test";
import { E2E_PREFIX, uniqueName, uniqueEmail, toast, confirmDelete, tableRow } from "./helpers";

/**
 * E2E coverage for the Users Management screen (admin/users).
 *
 * Safety: every mutating test creates its own uniquely-named user
 * (E2E_PREFIX) and removes it afterwards. No test touches a pre-existing
 * seed user, and every created user uses the Supervisor role so it can't
 * be mistaken for a Mentor/Parent/Student record managed by those specs.
 */

function userRow(page: Page, name: string) {
  return tableRow(page, name);
}

async function createUser(page: Page, name: string, email: string) {
  await page.getByRole("button", { name: "Add User", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Full name").fill(name);
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  await dialog.getByLabel("Role", { exact: true }).selectOption({ label: "Supervisor" });
  await dialog.getByRole("button", { name: /^create user$/i }).click();
  await expect(dialog).toBeHidden();
  await expect(userRow(page, name)).toBeVisible();
}

async function deleteUserIfExists(page: Page, name: string) {
  await page.goto("/admin/users");
  const row = userRow(page, name);
  if ((await row.count()) === 0) return;
  await confirmDelete(page, row.getByRole("button", { name: /^delete$/i }));
}

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await page.goto("/admin/users");
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
  await page.goto("/admin/users");
});

test("page loads with the users list, tabs and table columns", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Users Management", exact: true })).toBeVisible();
  // Scoped to <main> — the sidebar nav also has "Parents"/"Students" links.
  const main = page.getByRole("main");
  for (const tab of ["All Users", "Staff", "Parents", "Students"]) {
    await expect(main.getByRole("link", { name: tab, exact: true })).toBeVisible();
  }
  for (const col of ["Name", "Email", "Role", "Institution", "Status", "Created", "Actions"]) {
    await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
  }
});

test("creates a new user, shows a success toast, and it appears in the list", async ({ page }) => {
  const name = uniqueName("user-");
  const email = uniqueEmail("user");
  try {
    await createUser(page, name, email);
    await expect(toast(page, /User created/i)).toBeVisible();

    const row = userRow(page, name);
    await expect(row.getByText(email, { exact: true })).toBeVisible();
    await expect(row.getByText("Supervisor", { exact: true })).toBeVisible();

    await page.reload();
    await expect(userRow(page, name)).toBeVisible();
  } finally {
    await deleteUserIfExists(page, name);
  }
});

test("rejects an empty name, a malformed email, and a duplicate email", async ({ page }) => {
  const name = uniqueName("user-");
  const email = uniqueEmail("user-dupe");
  try {
    await createUser(page, name, email);

    // Empty name — blocked by the required attribute.
    await page.getByRole("button", { name: "Add User", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Full name").fill("");
    await dialog.getByLabel("Email", { exact: true }).fill(uniqueEmail("user"));
    await dialog.getByRole("button", { name: /^create user$/i }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Full name")).toHaveJSProperty("validity.valueMissing", true);

    // Malformed email — native type="email" validation blocks submission client-side.
    await dialog.getByLabel("Full name").fill(uniqueName("user-"));
    await dialog.getByLabel("Email", { exact: true }).fill("not-an-email");
    await dialog.getByRole("button", { name: /^create user$/i }).click();
    await expect(dialog.getByLabel("Email", { exact: true })).toHaveJSProperty("validity.typeMismatch", true);
    await expect(dialog).toBeVisible();

    // Duplicate email — server-side uniqueness check surfaces inline.
    const secondName = uniqueName("user-");
    await dialog.getByLabel("Email", { exact: true }).fill(email);
    await dialog.getByRole("button", { name: /^create user$/i }).click();
    await expect(dialog.getByText(/already in use/i)).toBeVisible();
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await page.reload();
    await expect(userRow(page, secondName)).toHaveCount(0);
  } finally {
    await deleteUserIfExists(page, name);
  }
});

test("edits a user: name, title and phone persist after reload", async ({ page }) => {
  const name = uniqueName("user-");
  const renamed = uniqueName("user-renamed-");
  try {
    await createUser(page, name, uniqueEmail("user"));

    await userRow(page, name).getByRole("button", { name: /^edit$/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Full name").fill(renamed);
    await dialog.getByLabel("Title / Designation").fill("Regional Coordinator");
    await dialog.getByLabel("Phone").fill("+91 90000 11111");
    await dialog.getByRole("button", { name: /save changes/i }).click();
    await expect(dialog).toBeHidden();
    await expect(toast(page, /User updated/i)).toBeVisible();

    const row = userRow(page, renamed);
    await expect(row).toBeVisible();
    await expect(userRow(page, name)).toHaveCount(0);

    await page.reload();
    await expect(userRow(page, renamed)).toBeVisible();
  } finally {
    await deleteUserIfExists(page, renamed);
    await deleteUserIfExists(page, name);
  }
});

test("deactivating and reactivating a user updates its status", async ({ page }) => {
  const name = uniqueName("user-");
  try {
    await createUser(page, name, uniqueEmail("user"));
    const row = userRow(page, name);
    await expect(row.getByText("Active", { exact: true })).toBeVisible();

    await row.getByRole("button", { name: /deactivate/i }).click();
    await expect(row.getByText("Inactive", { exact: true })).toBeVisible();

    await row.getByRole("button", { name: /^activate$/i }).click();
    await expect(row.getByText("Active", { exact: true })).toBeVisible();
  } finally {
    await deleteUserIfExists(page, name);
  }
});

test("deletes a user via the confirmation dialog", async ({ page }) => {
  const name = uniqueName("user-");
  await createUser(page, name, uniqueEmail("user"));

  await userRow(page, name).getByRole("button", { name: /^delete$/i }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();

  await confirm.getByRole("button", { name: /cancel/i }).click();
  await expect(confirm).toBeHidden();
  await expect(userRow(page, name)).toBeVisible();

  await userRow(page, name).getByRole("button", { name: /^delete$/i }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /^delete$/i }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(toast(page, /User deleted/i)).toBeVisible();
  await expect(userRow(page, name)).toHaveCount(0);

  await page.reload();
  await expect(userRow(page, name)).toHaveCount(0);
});
