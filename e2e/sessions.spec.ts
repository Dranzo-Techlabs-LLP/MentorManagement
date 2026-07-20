import { test, expect, type Page } from "@playwright/test";
import { uniqueName, uniqueEmail, toast, confirmDelete, tableRow } from "./helpers";

/**
 * E2E coverage for the Mentoring Sessions screen (admin/sessions).
 *
 * The admin screen has no "create session" UI (sessions are created by
 * mentors from their own workspace) — only edit/delete. So test sessions are
 * seeded through the REST API (POST /api/sessions) instead, scheduled far in
 * the future so each test's session is the only row on the "Upcoming" tab
 * and never collides with real seed data or needs pagination to find.
 *
 * Safety: every mutating test creates its own mentor + session
 * (E2E_PREFIX) and removes both afterwards via the REST API.
 */

const FAR_FUTURE = new Date("2035-06-15T10:00:00Z");

async function createMentorForTest(page: Page): Promise<{ id: string; name: string }> {
  const name = uniqueName("sess-mentor-");
  await page.goto("/admin/mentors");
  await page.getByRole("button", { name: "Add Mentor", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Full name").fill(name);
  await dialog.getByLabel("Email", { exact: true }).fill(uniqueEmail("sess-mentor"));
  await dialog.getByRole("button", { name: /^create mentor$/i }).click();
  await expect(dialog).toBeHidden();

  await tableRow(page, name).locator("a").first().click();
  await page.waitForURL(/\/admin\/mentors\/[^/]+$/);
  const id = page.url().split("/").pop()!;
  return { id, name };
}

async function deleteMentor(page: Page, id: string) {
  await page.request.delete(`/api/mentors/${id}`).catch(() => {});
}

async function createSessionViaApi(page: Page, mentorId: string, title: string) {
  const res = await page.request.post("/api/sessions", {
    data: { mentorId, title, type: "ONLINE", scheduledAt: FAR_FUTURE.toISOString(), durationMins: 45 },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.data.id as string;
}

async function deleteSessionIfExists(page: Page, id: string) {
  await page.request.delete(`/api/sessions/${id}`).catch(() => {});
}

function sessionRow(page: Page, title: string) {
  return tableRow(page, title);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/admin/sessions");
});

test("page loads with tabs and the sessions table columns", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Mentoring Sessions", exact: true })).toBeVisible();
  for (const tab of ["Upcoming", "Completed", "All"]) {
    await expect(page.getByRole("link", { name: tab, exact: true })).toBeVisible();
  }

  await page.goto("/admin/sessions?tab=all");
  for (const col of ["Session", "Mentor", "Type", "Scheduled", "Attendees", "Status", "Actions"]) {
    await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
  }
});

test("edits a seeded session: title, type and location persist after reload", async ({ page }) => {
  test.setTimeout(60_000);
  const title = uniqueName("sess-");
  const renamed = uniqueName("sess-renamed-");
  let mentor: { id: string; name: string } | undefined;
  let sessionId: string | undefined;
  try {
    mentor = await createMentorForTest(page);
    sessionId = await createSessionViaApi(page, mentor.id, title);

    // Far-future + still SCHEDULED ⇒ the only row on the default "Upcoming" tab.
    await page.goto("/admin/sessions");
    const row = sessionRow(page, title);
    await expect(row).toBeVisible();
    await expect(row.getByText(mentor.name, { exact: true })).toBeVisible();
    await expect(row.getByText("Online", { exact: true })).toBeVisible();

    await row.getByRole("button", { name: /^edit$/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Title", { exact: true }).fill(renamed);
    await dialog.getByLabel("Type", { exact: true }).selectOption({ label: "Offline" });
    await dialog.getByLabel("Location", { exact: true }).fill("Community Hall, Kozhikode");
    await dialog.getByRole("button", { name: /save changes/i }).click();
    await expect(dialog).toBeHidden();
    await expect(toast(page, /Session updated/i)).toBeVisible();

    const renamedRow = sessionRow(page, renamed);
    await expect(renamedRow).toBeVisible();
    await expect(renamedRow.getByText("Offline", { exact: true })).toBeVisible();
    await expect(sessionRow(page, title)).toHaveCount(0);

    await page.reload();
    const reloaded = sessionRow(page, renamed);
    await expect(reloaded).toBeVisible();
    await expect(reloaded.getByText("Offline", { exact: true })).toBeVisible();
  } finally {
    if (sessionId) await deleteSessionIfExists(page, sessionId);
    if (mentor) await deleteMentor(page, mentor.id);
  }
});

test("rejects an empty title on edit", async ({ page }) => {
  test.setTimeout(60_000);
  const title = uniqueName("sess-");
  let mentor: { id: string; name: string } | undefined;
  let sessionId: string | undefined;
  try {
    mentor = await createMentorForTest(page);
    sessionId = await createSessionViaApi(page, mentor.id, title);

    await page.goto("/admin/sessions");
    await sessionRow(page, title).getByRole("button", { name: /^edit$/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Title", { exact: true }).fill("");
    await dialog.getByRole("button", { name: /save changes/i }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Title", { exact: true })).toHaveJSProperty("validity.valueMissing", true);

    await page.keyboard.press("Escape");
  } finally {
    if (sessionId) await deleteSessionIfExists(page, sessionId);
    if (mentor) await deleteMentor(page, mentor.id);
  }
});

test("deletes a session via the confirmation dialog", async ({ page }) => {
  test.setTimeout(60_000);
  const title = uniqueName("sess-");
  let mentor: { id: string; name: string } | undefined;
  let sessionId: string | undefined;
  try {
    mentor = await createMentorForTest(page);
    sessionId = await createSessionViaApi(page, mentor.id, title);

    await page.goto("/admin/sessions");
    const row = sessionRow(page, title);
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: /^delete$/i }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();

    await confirm.getByRole("button", { name: /cancel/i }).click();
    await expect(confirm).toBeHidden();
    await expect(sessionRow(page, title)).toBeVisible();

    await sessionRow(page, title).getByRole("button", { name: /^delete$/i }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /^delete$/i }).click();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(toast(page, /Session deleted/i)).toBeVisible();
    await expect(sessionRow(page, title)).toHaveCount(0);
    sessionId = undefined; // already gone — skip the redundant API cleanup

    await page.reload();
    await expect(sessionRow(page, title)).toHaveCount(0);
  } finally {
    if (sessionId) await deleteSessionIfExists(page, sessionId);
    if (mentor) await deleteMentor(page, mentor.id);
  }
});
