import { test, expect, type Page } from "@playwright/test";
import { E2E_PREFIX, uniqueName, toast, confirmDelete } from "./helpers";

/**
 * E2E coverage for the Announcements screen (admin/announcements).
 *
 * Announcements render as cards (not a `<table>`), so rows are located via
 * the ".card" container that wraps each announcement's heading + actions.
 *
 * Safety: every mutating test creates its own uniquely-titled announcement
 * (E2E_PREFIX) and removes it afterwards. No test touches a pre-existing
 * seed announcement.
 */

function announcementCard(page: Page, title: string) {
  return page.locator(".card").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

async function createAnnouncement(page: Page, title: string, body = "E2E test announcement body.") {
  await page.getByRole("button", { name: "New Announcement", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Title", { exact: true }).fill(title);
  await dialog.getByLabel("Message").fill(body);
  await dialog.getByRole("button", { name: /publish announcement/i }).click();
  await expect(dialog).toBeHidden();
  await expect(announcementCard(page, title)).toBeVisible();
}

async function deleteAnnouncementIfExists(page: Page, title: string) {
  await page.goto("/admin/announcements");
  const card = announcementCard(page, title);
  if ((await card.count()) === 0) return;
  await confirmDelete(page, card.getByRole("button", { name: /^delete$/i }));
}

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await page.goto("/admin/announcements");
    const leftovers = page.locator(".card").filter({ has: page.getByRole("heading", { name: new RegExp(`^${E2E_PREFIX}`) }) });
    for (let i = await leftovers.count(); i > 0; i--) {
      const card = leftovers.first();
      if ((await card.count()) === 0) break;
      await confirmDelete(page, card.getByRole("button", { name: /^delete$/i }));
    }
  } catch {
    // best-effort cleanup — never fail the run here
  } finally {
    await page.close();
  }
});

test.beforeEach(async ({ page }) => {
  await page.goto("/admin/announcements");
});

test("page loads with the announcements list", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Announcements", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "New Announcement", exact: true })).toBeVisible();
});

test("creates a new announcement, shows a success toast, and it appears in the list", async ({ page }) => {
  const title = uniqueName("ann-");
  try {
    await createAnnouncement(page, title, "This is a test announcement created by Playwright.");
    await expect(toast(page, /Announcement published/i)).toBeVisible();

    const card = announcementCard(page, title);
    await expect(card.getByText("This is a test announcement created by Playwright.")).toBeVisible();
    await expect(card.getByText("All", { exact: true })).toBeVisible();

    await page.reload();
    await expect(announcementCard(page, title)).toBeVisible();
  } finally {
    await deleteAnnouncementIfExists(page, title);
  }
});

test("rejects an empty title and creates nothing", async ({ page }) => {
  await page.getByRole("button", { name: "New Announcement", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title", { exact: true }).fill("");
  await dialog.getByLabel("Message").fill("Body without a title.");
  await dialog.getByRole("button", { name: /publish announcement/i }).click();

  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveJSProperty("validity.valueMissing", true);

  await page.keyboard.press("Escape");
  await expect(page.getByText("Body without a title.")).toHaveCount(0);
});

test("edits an announcement: title, message, audience and pin persist after reload", async ({ page }) => {
  const title = uniqueName("ann-");
  const renamed = uniqueName("ann-renamed-");
  try {
    await createAnnouncement(page, title);

    await announcementCard(page, title).getByRole("button", { name: /^edit$/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Title", { exact: true }).fill(renamed);
    await dialog.getByLabel("Message").fill("Updated announcement body.");
    await dialog.getByLabel("Audience").selectOption({ label: "Mentors" });
    await dialog.getByLabel("Pin to top").check();
    await dialog.getByRole("button", { name: /save changes/i }).click();
    await expect(dialog).toBeHidden();
    await expect(toast(page, /Announcement updated/i)).toBeVisible();

    const card = announcementCard(page, renamed);
    await expect(card).toBeVisible();
    await expect(card.getByText("Updated announcement body.")).toBeVisible();
    await expect(card.getByText("Mentors", { exact: true })).toBeVisible();
    await expect(card.getByText("Pinned", { exact: true })).toBeVisible();
    await expect(announcementCard(page, title)).toHaveCount(0);

    await page.reload();
    const reloaded = announcementCard(page, renamed);
    await expect(reloaded).toBeVisible();
    await expect(reloaded.getByText("Pinned", { exact: true })).toBeVisible();
  } finally {
    await deleteAnnouncementIfExists(page, renamed);
    await deleteAnnouncementIfExists(page, title);
  }
});

test("deletes an announcement via the confirmation dialog", async ({ page }) => {
  const title = uniqueName("ann-");
  await createAnnouncement(page, title);

  await announcementCard(page, title).getByRole("button", { name: /^delete$/i }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();

  await confirm.getByRole("button", { name: /cancel/i }).click();
  await expect(confirm).toBeHidden();
  await expect(announcementCard(page, title)).toBeVisible();

  await announcementCard(page, title).getByRole("button", { name: /^delete$/i }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /^delete$/i }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(toast(page, /Announcement deleted/i)).toBeVisible();
  await expect(announcementCard(page, title)).toHaveCount(0);

  await page.reload();
  await expect(announcementCard(page, title)).toHaveCount(0);
});
