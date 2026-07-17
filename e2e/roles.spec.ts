import { test, expect, type Page } from "@playwright/test";

/**
 * E2E coverage for the Roles & Responsibilities screen.
 *
 * Safety: every mutating test creates its own uniquely-named role (E2E_PREFIX)
 * and removes it afterwards. No test edits or deletes a system role or any
 * pre-existing custom role, so this suite is safe to run against a live
 * environment.
 */

const E2E_PREFIX = "__e2e-";
const uniqueRoleName = () => `${E2E_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const SYSTEM_ROLES = ["Super Admin", "Chief Mentor", "Supervisor", "Mentor", "Parent", "Student"];

/** A role's collapsible row. Scoped by exact name — the page renders every
 *  role's inputs in the DOM, so unscoped locators would hit the wrong role. */
function roleRow(page: Page, name: string) {
  return page.locator("details", { has: page.getByText(name, { exact: true }) }).first();
}

async function openRoleRow(page: Page, name: string) {
  const row = roleRow(page, name);
  await expect(row).toBeVisible();
  if (!(await row.evaluate((el: HTMLDetailsElement) => el.open))) {
    await row.locator("summary").click();
  }
  await expect(row.getByRole("columnheader", { name: "Module / Section" })).toBeVisible();
  return row;
}

async function createRole(page: Page, name: string, baseRole = "Supervisor") {
  await page.getByRole("button", { name: "Create Role", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Role name").fill(name);
  await dialog.getByLabel(/Workspace/).selectOption({ label: baseRole });
  await dialog.getByRole("button", { name: /^create role$/i }).click();
  await expect(dialog).toBeHidden();
  await expect(roleRow(page, name)).toBeVisible();
}

async function deleteRoleIfExists(page: Page, name: string) {
  await page.goto("/admin/roles");
  const row = roleRow(page, name);
  if ((await row.count()) === 0) return;
  await row.getByRole("button", { name: /^delete$/i }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: /^delete$/i }).click();
  await expect(confirm).toBeHidden();
}

/** Sweep any roles left behind by a failed run. */
test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await page.goto("/admin/roles");
    const leftovers = page.locator("details", { has: page.getByText(new RegExp(`^${E2E_PREFIX}`)) });
    for (let i = await leftovers.count(); i > 0; i--) {
      const row = leftovers.first();
      if ((await row.count()) === 0) break;
      await row.getByRole("button", { name: /^delete$/i }).click();
      const confirm = page.getByRole("alertdialog");
      await confirm.getByRole("button", { name: /^delete$/i }).click();
      await expect(confirm).toBeHidden();
    }
  } catch {
    // best-effort cleanup — never fail the run here
  } finally {
    await page.close();
  }
});

test.beforeEach(async ({ page }) => {
  await page.goto("/admin/roles");
});

// ---------------------------------------------------------------------------
// 1. Page load
// ---------------------------------------------------------------------------
test("page loads with the roles list and permission matrix columns", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Roles & Responsibilities" })).toBeVisible();

  // All six seeded system roles are listed.
  for (const name of SYSTEM_ROLES) {
    await expect(roleRow(page, name)).toBeVisible();
  }

  // Matrix headers = the four permissions.
  const row = await openRoleRow(page, "Mentor");
  for (const col of ["Module / Section", "Create", "View", "Edit", "Delete"]) {
    await expect(row.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
  }

  // Resource rows render.
  for (const resource of ["Students", "Mentors", "Institutions", "Settings & Roles"]) {
    await expect(row.getByRole("cell", { name: resource, exact: true })).toBeVisible();
  }
});

// ---------------------------------------------------------------------------
// 2. Create role
// ---------------------------------------------------------------------------
test("creates a new role and it appears in the list", async ({ page }) => {
  const name = uniqueRoleName();
  try {
    await createRole(page, name, "Supervisor");

    const row = roleRow(page, name);
    await expect(row.getByText("Custom", { exact: true })).toBeVisible();
    await expect(row.getByText("Workspace: Supervisor")).toBeVisible();
    await expect(row.getByText("0 users")).toBeVisible();

    // Persists across a reload (it's in the DB, not just optimistic UI).
    await page.reload();
    await expect(roleRow(page, name)).toBeVisible();
  } finally {
    await deleteRoleIfExists(page, name);
  }
});

// ---------------------------------------------------------------------------
// 3. Validation
// ---------------------------------------------------------------------------
test("rejects an empty role name and creates nothing", async ({ page }) => {
  const before = await page.locator("details").count();

  await page.getByRole("button", { name: "Create Role", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Role name").fill("");
  await dialog.getByRole("button", { name: /^create role$/i }).click();

  // The required field blocks submission: dialog stays open, field is invalid.
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Role name")).toHaveJSProperty("validity.valueMissing", true);

  await page.keyboard.press("Escape");
  await page.reload();
  expect(await page.locator("details").count()).toBe(before);
});

test("rejects a duplicate role name with an error and creates no second role", async ({ page }) => {
  const name = uniqueRoleName();
  try {
    await createRole(page, name);

    // Attempt the same name again.
    await page.getByRole("button", { name: "Create Role", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Role name").fill(name);
    await dialog.getByRole("button", { name: /^create role$/i }).click();

    // Server-side uniqueness check surfaces inline; dialog stays open.
    await expect(dialog.getByText(/already exists/i)).toBeVisible();
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await page.reload();
    // Still exactly one role with that name.
    await expect(page.locator("details", { has: page.getByText(name, { exact: true }) })).toHaveCount(1);
  } finally {
    await deleteRoleIfExists(page, name);
  }
});

// ---------------------------------------------------------------------------
// 4. Edit role — rename + change permissions, persisted across reload
// ---------------------------------------------------------------------------
test("edits a role: rename and permission changes persist after reload", async ({ page }) => {
  const name = uniqueRoleName();
  const renamed = `${name}-renamed`;
  try {
    await createRole(page, name, "Supervisor");

    // --- rename ---
    await roleRow(page, name).getByRole("button", { name: /^edit$/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Role name").fill(renamed);
    await dialog.getByRole("button", { name: /save changes/i }).click();
    await expect(dialog).toBeHidden();

    await expect(roleRow(page, renamed)).toBeVisible();
    await expect(page.locator("details", { has: page.getByText(name, { exact: true }) })).toHaveCount(0);

    // --- toggle a permission ---
    const row = await openRoleRow(page, renamed);
    const institutionsDelete = row.locator('input[name="institutions.delete"]');
    const before = await institutionsDelete.isChecked();
    await institutionsDelete.setChecked(!before);
    await row.getByRole("button", { name: /save permissions/i }).click();
    await expect(row.getByText("Permissions saved.")).toBeVisible();

    // --- persists across reload ---
    await page.reload();
    const reloaded = await openRoleRow(page, renamed);
    await expect(reloaded.locator('input[name="institutions.delete"]')).toBeChecked({ checked: !before });
  } finally {
    await deleteRoleIfExists(page, renamed);
    await deleteRoleIfExists(page, name);
  }
});

// ---------------------------------------------------------------------------
// 5. Assign / unassign responsibilities
// ---------------------------------------------------------------------------
test("assigning and unassigning responsibilities reflects and persists", async ({ page }) => {
  const name = uniqueRoleName();
  try {
    await createRole(page, name, "Mentor");
    const row = await openRoleRow(page, name);

    const grant = row.locator('input[name="students.create"]');   // Mentor default: false
    const revoke = row.locator('input[name="students.view"]');    // Mentor default: true

    // UI reflects the seeded defaults for the base role.
    await expect(grant).not.toBeChecked();
    await expect(revoke).toBeChecked();

    // Assign one, unassign the other.
    await grant.check();
    await revoke.uncheck();
    await expect(grant).toBeChecked();
    await expect(revoke).not.toBeChecked();

    await row.getByRole("button", { name: /save permissions/i }).click();
    await expect(row.getByText("Permissions saved.")).toBeVisible();

    await page.reload();
    const reloaded = await openRoleRow(page, name);
    await expect(reloaded.locator('input[name="students.create"]')).toBeChecked();
    await expect(reloaded.locator('input[name="students.view"]')).not.toBeChecked();
  } finally {
    await deleteRoleIfExists(page, name);
  }
});

// ---------------------------------------------------------------------------
// 6. Delete role
// ---------------------------------------------------------------------------
test("deletes a role via the confirmation dialog", async ({ page }) => {
  const name = uniqueRoleName();
  await createRole(page, name);

  await roleRow(page, name).getByRole("button", { name: /^delete$/i }).click();

  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await expect(confirm.getByText(`Delete the "${name}" role?`)).toBeVisible();

  // Cancelling leaves it intact.
  await confirm.getByRole("button", { name: /cancel/i }).click();
  await expect(confirm).toBeHidden();
  await expect(roleRow(page, name)).toBeVisible();

  // Confirming removes it.
  await roleRow(page, name).getByRole("button", { name: /^delete$/i }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /^delete$/i }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(roleRow(page, name)).toHaveCount(0);

  await page.reload();
  await expect(roleRow(page, name)).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// 7. Permission enforcement / lockout protection
// ---------------------------------------------------------------------------
test("Super Admin permissions are locked and cannot be edited or revoked", async ({ page }) => {
  const row = await openRoleRow(page, "Super Admin");

  await expect(row.getByText(/locked to prevent lockout/i)).toBeVisible();
  await expect(row.getByText(/cannot be edited or revoked/i)).toBeVisible();

  // Every checkbox is checked and disabled.
  const boxes = row.getByRole("checkbox");
  const count = await boxes.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(boxes.nth(i)).toBeChecked();
    await expect(boxes.nth(i)).toBeDisabled();
  }

  // No way to save changes, and no way to delete the role.
  await expect(row.getByRole("button", { name: /save permissions/i })).toHaveCount(0);
  await expect(row.getByRole("button", { name: /^delete$/i })).toHaveCount(0);
});

test("system roles cannot be deleted or renamed", async ({ page }) => {
  for (const name of SYSTEM_ROLES) {
    const row = roleRow(page, name);
    await expect(row.getByText("System", { exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: /^delete$/i })).toHaveCount(0);
    await expect(row.getByRole("button", { name: /^edit$/i })).toHaveCount(0);
  }
});

test("a non-super-admin cannot reach the Roles screen", async ({ browser }) => {
  const email = process.env.MENTOR_EMAIL;
  const password = process.env.MENTOR_PASSWORD;
  test.skip(!email || !password, "Set MENTOR_EMAIL / MENTOR_PASSWORD to run this check.");

  // Fresh context: must NOT reuse the admin storageState.
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  try {
    await page.goto("/login");
    await page.getByPlaceholder("you@ndhrglobal.com").fill(email!);
    await page.getByPlaceholder("••••••••").fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/mentor(\/|$)/, { timeout: 20_000 });

    await page.goto("/admin/roles");
    // Redirected away — never renders the matrix.
    await expect(page).not.toHaveURL(/\/admin\/roles/);
    await expect(page.getByRole("heading", { name: "Roles & Responsibilities" })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
