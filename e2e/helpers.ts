import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Shared helpers for the CRUD specs. Every mutating test creates its own
 * uniquely-named record (E2E_PREFIX) and removes it in a `finally` block, so
 * the suite is safe to run against a live environment and never touches
 * pre-existing seed data.
 */

export const E2E_PREFIX = "__e2e-";
export const uniqueName = (label = "") => `${E2E_PREFIX}${label}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
export const uniqueEmail = (label = "e2e") => `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;

/**
 * Success toast (role="status", lives at the root so it outlives the modal).
 * Matched by its distinct text, so a still-visible earlier toast can't satisfy
 * a later assertion. `.first()` keeps it strict-mode safe if two toasts stack.
 */
export function toast(page: Page, text: string | RegExp) {
  return page.getByRole("status").filter({ hasText: text }).first();
}

/** Clicks a row's Delete trigger and confirms the alertdialog. */
export async function confirmDelete(page: Page, deleteTrigger: Locator) {
  await deleteTrigger.click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: /^delete$/i }).click();
  await expect(confirm).toBeHidden();
}

/**
 * A `<table>` row containing an exact-text match, e.g. a record's name.
 * Uses exact text (not a "starts with" regex) so a renamed record like
 * "foo-renamed" can never accidentally match a locator built for "foo".
 */
export function tableRow(page: Page, text: string) {
  return page.getByRole("row").filter({ has: page.getByText(text, { exact: true }) });
}
