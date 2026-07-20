import { test, expect, type Page } from "@playwright/test";
import { E2E_PREFIX, uniqueName, uniqueEmail, toast, confirmDelete, tableRow } from "./helpers";

/**
 * E2E coverage for the Mentors screens (admin/mentors list + admin/mentors/[id] detail).
 *
 * Safety: every mutating test creates its own uniquely-named mentor and/or
 * student (E2E_PREFIX) and removes them afterwards. No test touches a
 * pre-existing seed mentor or student.
 */

function mentorRow(page: Page, name: string) {
  return tableRow(page, name);
}

async function createMentor(page: Page, name: string, email: string) {
  await page.getByRole("button", { name: "Add Mentor", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Full name").fill(name);
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  await dialog.getByRole("button", { name: /^create mentor$/i }).click();
  await expect(dialog).toBeHidden();
  await expect(mentorRow(page, name)).toBeVisible();
}

async function deleteMentorIfExists(page: Page, name: string) {
  await page.goto("/admin/mentors");
  const row = mentorRow(page, name);
  if ((await row.count()) === 0) return;
  await confirmDelete(page, row.getByRole("button", { name: /^delete$/i }));
}

async function createStudent(page: Page, name: string) {
  await page.goto("/admin/students");
  await page.getByRole("button", { name: "Add Student", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Full name").fill(name);
  await dialog.getByRole("button", { name: /^create student$/i }).click();
  await expect(dialog).toBeHidden();
  await expect(tableRow(page, name)).toBeVisible();
}

async function deleteStudentIfExists(page: Page, name: string) {
  await page.goto("/admin/students");
  const row = tableRow(page, name);
  if ((await row.count()) === 0) return;
  await confirmDelete(page, row.getByRole("button", { name: /^delete$/i }));
}

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await page.goto("/admin/mentors");
    const leftoverMentors = page.getByRole("row", { name: new RegExp(`^${E2E_PREFIX}`) });
    for (let i = await leftoverMentors.count(); i > 0; i--) {
      const row = leftoverMentors.first();
      if ((await row.count()) === 0) break;
      await confirmDelete(page, row.getByRole("button", { name: /^delete$/i }));
    }
    await page.goto("/admin/students");
    const leftoverStudents = page.getByRole("row", { name: new RegExp(`^${E2E_PREFIX}`) });
    for (let i = await leftoverStudents.count(); i > 0; i--) {
      const row = leftoverStudents.first();
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
  await page.goto("/admin/mentors");
});

test("page loads with the mentors list, stat cards and table columns", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Mentors", exact: true })).toBeVisible();
  for (const stat of ["Total Mentors", "Mentees Assigned", "Sessions Conducted", "Avg Feedback Rating"]) {
    await expect(page.getByText(stat, { exact: true })).toBeVisible();
  }
  for (const col of ["Mentor", "Institution", "Mentees", "Supervisor", "Sessions", "Rating", "Status", "Actions"]) {
    await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
  }
});

test("creates a new mentor, shows a success toast, and it appears in the list", async ({ page }) => {
  const name = uniqueName("mentor-");
  const email = uniqueEmail("mentor");
  try {
    await createMentor(page, name, email);
    await expect(toast(page, /Mentor created/i)).toBeVisible();

    const row = mentorRow(page, name);
    await expect(row.getByText(email, { exact: true })).toBeVisible();

    await page.reload();
    await expect(mentorRow(page, name)).toBeVisible();
  } finally {
    await deleteMentorIfExists(page, name);
  }
});

test("rejects an empty name and a duplicate email", async ({ page }) => {
  const name = uniqueName("mentor-");
  const email = uniqueEmail("mentor-dupe");
  try {
    await createMentor(page, name, email);

    // Empty name — blocked by the required attribute.
    await page.getByRole("button", { name: "Add Mentor", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Full name").fill("");
    await dialog.getByLabel("Email", { exact: true }).fill(uniqueEmail("mentor"));
    await dialog.getByRole("button", { name: /^create mentor$/i }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Full name")).toHaveJSProperty("validity.valueMissing", true);

    // Duplicate email — server-side uniqueness check surfaces inline.
    const secondName = uniqueName("mentor-");
    await dialog.getByLabel("Full name").fill(secondName);
    await dialog.getByLabel("Email", { exact: true }).fill(email);
    await dialog.getByRole("button", { name: /^create mentor$/i }).click();
    await expect(dialog.getByText(/already in use/i)).toBeVisible();
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await page.reload();
    await expect(mentorRow(page, secondName)).toHaveCount(0);
  } finally {
    await deleteMentorIfExists(page, name);
  }
});

test("edits a mentor: name, title and city persist after reload", async ({ page }) => {
  const name = uniqueName("mentor-");
  const renamed = uniqueName("mentor-renamed-");
  try {
    await createMentor(page, name, uniqueEmail("mentor"));

    await mentorRow(page, name).getByRole("button", { name: /^edit$/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Full name").fill(renamed);
    await dialog.getByLabel("City").fill("Kannur");
    await dialog.getByRole("button", { name: /save changes/i }).click();
    await expect(dialog).toBeHidden();
    await expect(toast(page, /Mentor updated/i)).toBeVisible();

    const row = mentorRow(page, renamed);
    await expect(row).toBeVisible();
    await expect(mentorRow(page, name)).toHaveCount(0);

    await page.reload();
    await expect(mentorRow(page, renamed)).toBeVisible();
  } finally {
    await deleteMentorIfExists(page, renamed);
    await deleteMentorIfExists(page, name);
  }
});

test("mentor profile page: assigning and unassigning a student reflects and persists", async ({ page }) => {
  // Several full page navigations across two entities — the steady-state run
  // is well under 15s, but the first hit on a cold `next dev` route can add
  // a one-time compile tax (irrelevant in production, where routes are
  // pre-built by `next build`), so this gets extra margin over the default.
  test.setTimeout(90_000);
  const mentorName = uniqueName("mentor-");
  const studentName = uniqueName("student-");
  try {
    await createMentor(page, mentorName, uniqueEmail("mentor"));
    await createStudent(page, studentName);

    await page.goto("/admin/mentors");
    await mentorRow(page, mentorName).locator("a").first().click();
    await page.waitForURL(/\/admin\/mentors\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Mentor Profile", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: mentorName, exact: true })).toBeVisible();

    // Assign.
    await page.getByRole("button", { name: "Assign Student", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Student", { exact: true }).selectOption({ label: studentName });
    await dialog.getByRole("button", { name: /^assign$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(toast(page, /Student assigned/i)).toBeVisible();
    await expect(page.getByText(studentName, { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText(studentName, { exact: true })).toBeVisible();

    // Unassign.
    await page.getByRole("button", { name: /unassign/i }).click();
    await expect(toast(page, /Student unassigned/i)).toBeVisible();
    await expect(page.getByText(studentName, { exact: true })).toHaveCount(0);
  } finally {
    await deleteStudentIfExists(page, studentName);
    await deleteMentorIfExists(page, mentorName);
  }
});

test("deletes a mentor via the confirmation dialog", async ({ page }) => {
  const name = uniqueName("mentor-");
  await createMentor(page, name, uniqueEmail("mentor"));

  await mentorRow(page, name).getByRole("button", { name: /^delete$/i }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();

  await confirm.getByRole("button", { name: /cancel/i }).click();
  await expect(confirm).toBeHidden();
  await expect(mentorRow(page, name)).toBeVisible();

  await mentorRow(page, name).getByRole("button", { name: /^delete$/i }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /^delete$/i }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(toast(page, /Mentor deleted/i)).toBeVisible();
  await expect(mentorRow(page, name)).toHaveCount(0);

  await page.reload();
  await expect(mentorRow(page, name)).toHaveCount(0);
});
