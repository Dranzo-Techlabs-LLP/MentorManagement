import { test, expect, type Page, type Browser, type BrowserContext } from "@playwright/test";
import { uniqueName } from "./helpers";

/**
 * RBAC guard coverage for the Category A fix: chief/students, chief/mentors,
 * chief/supervisors, mentor/mentees, supervisor/mentors, supervisor/students,
 * supervisor/sessions now all call getPerms() and gate their Create/Edit/Delete
 * UI accordingly, instead of always rendering nothing (the original bug) or
 * (elsewhere in the app) always rendering unconditionally.
 *
 * Each role test does two things:
 *  1. Logs in as a REAL seeded account on its DEFAULT system role (no custom
 *     AppRole) and asserts the visible action buttons match DEFAULT_MATRIX
 *     exactly — this is the literal scenario from the bug report.
 *  2. Calls the underlying REST API directly (bypassing the UI) to confirm
 *     the same matrix is enforced server-side — "hiding a button is not
 *     authorization," so a granted op must succeed and a denied op must
 *     return 403 even via a hand-crafted request.
 *
 * Any resource created during an "allowed" API check is cleaned up through a
 * separate Super Admin request context, since the tested role may not itself
 * have delete rights on what it just created (e.g. Chief Mentor can create a
 * student but, by default, cannot delete one).
 */

async function loginAs(browser: Browser, email: string, password: string, urlPattern: RegExp) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByPlaceholder("you@ndhrglobal.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(urlPattern, { timeout: 20_000 });
  return { context, page };
}

async function adminContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ storageState: "e2e/.auth/admin.json" });
}

async function expectNoActions(page: Page) {
  await expect(page.getByRole("button", { name: /^edit$/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^delete$/i })).toHaveCount(0);
}

// ---------------------------------------------------------------------------
// Chief Mentor — students: create+view+edit (no delete) · mentors: view-only ·
// supervisors ("users" resource): none
// ---------------------------------------------------------------------------
test.describe("RBAC guard — Chief Mentor", () => {
  const email = process.env.CHIEF_EMAIL;
  const password = process.env.CHIEF_PASSWORD;

  test("visible actions on Students/Mentors/Supervisors match the default matrix", async ({ browser }) => {
    // Three brand-new routes, possibly hit cold on a `next dev` server — see
    // the same note on mentors.spec.ts's multi-navigation test.
    test.setTimeout(90_000);
    test.skip(!email || !password, "Set CHIEF_EMAIL / CHIEF_PASSWORD to run this check.");
    const { context, page } = await loginAs(browser, email!, password!, /\/chief(\/|$)/);
    try {
      await page.goto("/chief/students");
      await expect(page.getByRole("button", { name: "Add Student", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /^edit$/i }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /^delete$/i })).toHaveCount(0);

      await page.goto("/chief/mentors");
      await expect(page.getByRole("button", { name: "Add Mentor", exact: true })).toHaveCount(0);
      await expectNoActions(page);

      await page.goto("/chief/supervisors");
      await expect(page.getByRole("button", { name: "Add Supervisor", exact: true })).toHaveCount(0);
      await expectNoActions(page);
    } finally {
      await context.close();
    }
  });

  test("API enforces the same matrix on a direct request", async ({ browser }) => {
    test.skip(!email || !password, "Set CHIEF_EMAIL / CHIEF_PASSWORD to run this check.");
    const { context, page } = await loginAs(browser, email!, password!, /\/chief(\/|$)/);
    let createdStudentId: string | undefined;
    try {
      // Granted: students.create
      const createRes = await page.request.post("/api/students", { data: { fullName: uniqueName("rbac-chief-") } });
      expect(createRes.status()).toBe(201);
      createdStudentId = (await createRes.json()).data.id;

      // Denied: students.delete is false by default for Chief Mentor.
      const delRes = await page.request.delete(`/api/students/${createdStudentId}`);
      expect(delRes.status()).toBe(403);

      // Denied: mentors.create is false (view-only) by default for Chief Mentor.
      const mentorRes = await page.request.post("/api/mentors", { data: { name: "x", email: "x@example.com" } });
      expect(mentorRes.status()).toBe(403);
    } finally {
      if (createdStudentId) {
        const admin = await adminContext(browser);
        await admin.request.delete(`/api/students/${createdStudentId}`).catch(() => {});
        await admin.close();
      }
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Supervisor — students: create+view+edit (no delete) · mentors: view-only ·
// sessions: all four ops
// ---------------------------------------------------------------------------
test.describe("RBAC guard — Supervisor", () => {
  const email = process.env.SUPERVISOR_EMAIL;
  const password = process.env.SUPERVISOR_PASSWORD;

  test("visible actions on Students/Mentors/Sessions match the default matrix", async ({ browser }) => {
    test.setTimeout(90_000);
    test.skip(!email || !password, "Set SUPERVISOR_EMAIL / SUPERVISOR_PASSWORD to run this check.");
    const { context, page } = await loginAs(browser, email!, password!, /\/supervisor(\/|$)/);
    try {
      await page.goto("/supervisor/students");
      await expect(page.getByRole("button", { name: "Add Student", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /^delete$/i })).toHaveCount(0);

      await page.goto("/supervisor/mentors");
      await expect(page.getByRole("button", { name: "Add Mentor", exact: true })).toHaveCount(0);
      await expectNoActions(page);

      await page.goto("/supervisor/sessions?tab=all");
      // ALL=true — sessions with attendance rows exist in seed data, so an Edit
      // button should render (no create button exists anywhere for sessions —
      // matches admin/sessions, which also has no create UI).
      const rows = page.getByRole("row");
      if ((await rows.count()) > 1) {
        await expect(page.getByRole("button", { name: /^edit$/i }).first()).toBeVisible();
        await expect(page.getByRole("button", { name: /^delete$/i }).first()).toBeVisible();
      }
    } finally {
      await context.close();
    }
  });

  test("API enforces the same matrix on a direct request", async ({ browser }) => {
    test.skip(!email || !password, "Set SUPERVISOR_EMAIL / SUPERVISOR_PASSWORD to run this check.");
    const { context, page } = await loginAs(browser, email!, password!, /\/supervisor(\/|$)/);
    let sessionId: string | undefined;
    try {
      // Denied: mentors.create is false (view-only) by default for Supervisor.
      const mentorRes = await page.request.post("/api/mentors", { data: { name: "x", email: "x@example.com" } });
      expect(mentorRes.status()).toBe(403);

      // Set up a session as Super Admin (sessions.create isn't part of this
      // role's Category-A fix — only edit/delete are exercised, matching the
      // UI, which has no create button for sessions anywhere in the app).
      const admin = await adminContext(browser);
      const mentor = await admin.request.get("/api/mentors?pageSize=1");
      const mentorId = (await mentor.json()).data[0]?.id;
      const createRes = await admin.request.post("/api/sessions", {
        data: { mentorId, title: uniqueName("rbac-sup-"), type: "ONLINE", scheduledAt: new Date("2035-01-01T10:00:00Z").toISOString() },
      });
      sessionId = (await createRes.json()).data.id;
      await admin.close();

      // Granted: sessions.delete is true by default for Supervisor.
      const delRes = await page.request.delete(`/api/sessions/${sessionId}`);
      expect(delRes.status()).toBe(200);
      sessionId = undefined; // already gone
    } finally {
      if (sessionId) {
        const admin = await adminContext(browser);
        await admin.request.delete(`/api/sessions/${sessionId}`).catch(() => {});
        await admin.close();
      }
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Mentor — students: view-only (edits to a mentee's core profile happen via
// the "portfolio" resource — SWOC, goals, growth records — not here)
// ---------------------------------------------------------------------------
test.describe("RBAC guard — Mentor", () => {
  const email = process.env.MENTOR_EMAIL;
  const password = process.env.MENTOR_PASSWORD;

  test("no Create/Edit/Delete actions render on My Mentees by default", async ({ browser }) => {
    test.skip(!email || !password, "Set MENTOR_EMAIL / MENTOR_PASSWORD to run this check.");
    const { context, page } = await loginAs(browser, email!, password!, /\/mentor(\/|$)/);
    try {
      await page.goto("/mentor/mentees");
      await expect(page.getByRole("button", { name: "Add Student", exact: true })).toHaveCount(0);
      await expectNoActions(page);
    } finally {
      await context.close();
    }
  });

  test("API denies students.create for a default Mentor account", async ({ browser }) => {
    test.skip(!email || !password, "Set MENTOR_EMAIL / MENTOR_PASSWORD to run this check.");
    const { context, page } = await loginAs(browser, email!, password!, /\/mentor(\/|$)/);
    try {
      const res = await page.request.post("/api/students", { data: { fullName: uniqueName("rbac-mentor-") } });
      expect(res.status()).toBe(403);
    } finally {
      await context.close();
    }
  });
});
