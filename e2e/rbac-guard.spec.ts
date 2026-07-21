import { test, expect, type Page, type Browser, type BrowserContext } from "@playwright/test";
import { uniqueName, toast } from "./helpers";

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

// ---------------------------------------------------------------------------
// Sidebar visibility — the reported bug: a resource granted in Roles &
// Responsibilities must actually appear in the target role's sidebar.
//
// The nav used to be a hardcoded per-role list that the layout could only
// filter DOWN, so a role with no entry for a resource could never be granted
// visibility no matter what the matrix said.
// ---------------------------------------------------------------------------

/** Opens a role's collapsible row on /admin/roles and returns it. */
async function openRoleRow(page: Page, name: string) {
  const row = page.locator("details", { has: page.getByText(name, { exact: true }) }).first();
  await expect(row).toBeVisible();
  if (!(await row.evaluate((el: HTMLDetailsElement) => el.open))) {
    await row.locator("summary").click();
  }
  await expect(row.getByRole("columnheader", { name: "Module / Section" })).toBeVisible();
  return row;
}

/** Sets one checkbox in a role's permission matrix and saves. */
async function setRolePermission(page: Page, roleName: string, key: string, value: boolean) {
  await page.goto("/admin/roles");
  const row = await openRoleRow(page, roleName);
  const box = row.locator(`input[name="${key}"]`);
  await box.setChecked(value);
  await row.getByRole("button", { name: /save permissions/i }).click();
  await expect(toast(page, "Permissions saved.")).toBeVisible();
}

function navLink(page: Page, name: string) {
  return page.getByRole("navigation").getByRole("link", { name, exact: true });
}

test.describe("RBAC sidebar visibility", () => {
  const supEmail = process.env.SUPERVISOR_EMAIL;
  const supPassword = process.env.SUPERVISOR_PASSWORD;
  const chiefEmail = process.env.CHIEF_EMAIL;
  const chiefPassword = process.env.CHIEF_PASSWORD;

  test("Institutions is visible by default for Supervisor and Chief Mentor", async ({ browser }) => {
    test.setTimeout(90_000);
    test.skip(!supEmail || !supPassword || !chiefEmail || !chiefPassword, "Set SUPERVISOR_* / CHIEF_* to run this check.");

    const sup = await loginAs(browser, supEmail!, supPassword!, /\/supervisor(\/|$)/);
    try {
      await expect(navLink(sup.page, "Institutions")).toBeVisible();
      await sup.page.goto("/supervisor/institutions");
      await expect(sup.page.getByRole("heading", { name: "Institutions", exact: true })).toBeVisible();
      // view-only by default — no create/edit/delete controls.
      await expect(sup.page.getByRole("button", { name: "Add Institution", exact: true })).toHaveCount(0);
      await expectNoActions(sup.page);
    } finally {
      await sup.context.close();
    }

    const chief = await loginAs(browser, chiefEmail!, chiefPassword!, /\/chief(\/|$)/);
    try {
      await expect(navLink(chief.page, "Institutions")).toBeVisible();
      await chief.page.goto("/chief/institutions");
      await expect(chief.page.getByRole("heading", { name: "Institutions", exact: true })).toBeVisible();
    } finally {
      await chief.context.close();
    }
  });

  test("revoking institutions.view hides it for Supervisor; restoring brings it back", async ({ browser }) => {
    test.setTimeout(120_000);
    test.skip(!supEmail || !supPassword, "Set SUPERVISOR_EMAIL / SUPERVISOR_PASSWORD to run this check.");

    const admin = await adminContext(browser);
    const adminPage = await admin.newPage();
    try {
      // --- revoke ---
      await setRolePermission(adminPage, "Supervisor", "institutions.view", false);

      const revoked = await loginAs(browser, supEmail!, supPassword!, /\/supervisor(\/|$)/);
      try {
        await expect(navLink(revoked.page, "Institutions")).toHaveCount(0);
        // Direct URL is refused too — hiding the link is not the protection.
        await revoked.page.goto("/supervisor/institutions");
        await expect(revoked.page).not.toHaveURL(/\/supervisor\/institutions/);
      } finally {
        await revoked.context.close();
      }

      // --- restore ---
      await setRolePermission(adminPage, "Supervisor", "institutions.view", true);

      const restored = await loginAs(browser, supEmail!, supPassword!, /\/supervisor(\/|$)/);
      try {
        await expect(navLink(restored.page, "Institutions")).toBeVisible();
        await restored.page.goto("/supervisor/institutions");
        await expect(restored.page.getByRole("heading", { name: "Institutions", exact: true })).toBeVisible();
      } finally {
        await restored.context.close();
      }
    } finally {
      // Belt-and-braces: never leave the shared system role in a revoked state.
      await setRolePermission(adminPage, "Supervisor", "institutions.view", true).catch(() => {});
      await admin.close();
    }
  });

  /**
   * Every section the default matrix grants each role must be reachable from
   * that role's own sidebar AND open without redirecting. This is the general
   * form of the reported bug: previously these resources were granted but had
   * no nav entry, so they were invisible.
   */
  const REACHABLE: Record<string, { envUser: string; envPass: string; home: RegExp; sections: [string, string][] }> = {
    "Chief Mentor": {
      envUser: "CHIEF_EMAIL", envPass: "CHIEF_PASSWORD", home: /\/chief(\/|$)/,
      sections: [
        ["Parents", "/chief/parents"],
        ["Applications", "/chief/applications"],
        ["Mentor Applications", "/chief/mentor-applications"],
        ["Institutions", "/chief/institutions"],
        ["Sessions", "/chief/sessions"],
        ["Feedback", "/chief/feedback"],
        ["Announcements", "/chief/announcements"],
      ],
    },
    Supervisor: {
      envUser: "SUPERVISOR_EMAIL", envPass: "SUPERVISOR_PASSWORD", home: /\/supervisor(\/|$)/,
      sections: [
        ["Parents", "/supervisor/parents"],
        ["Institutions", "/supervisor/institutions"],
        ["Announcements", "/supervisor/announcements"],
      ],
    },
    Mentor: {
      envUser: "MENTOR_EMAIL", envPass: "MENTOR_PASSWORD", home: /\/mentor(\/|$)/,
      sections: [
        ["Feedback", "/mentor/feedback"],
        ["Announcements", "/mentor/announcements"],
      ],
    },
  };

  for (const [roleName, cfg] of Object.entries(REACHABLE)) {
    test(`${roleName}: every granted section is in the sidebar and opens`, async ({ browser }) => {
      test.setTimeout(90_000);
      const email = process.env[cfg.envUser];
      const password = process.env[cfg.envPass];
      test.skip(!email || !password, `Set ${cfg.envUser} / ${cfg.envPass} to run this check.`);

      const { context, page } = await loginAs(browser, email!, password!, cfg.home);
      try {
        for (const [label, href] of cfg.sections) {
          await expect(navLink(page, label), `${roleName} sidebar is missing "${label}"`).toBeVisible();
          await page.goto(href);
          // Landing anywhere else means the page bounced the user out.
          await expect(page, `${roleName} was redirected away from ${href}`).toHaveURL(new RegExp(href.replace(/\//g, "\\/")));
        }
      } finally {
        await context.close();
      }
    });
  }

  test("Parent and Student can reach Announcements", async ({ browser }) => {
    test.setTimeout(90_000);
    const cases: [string, string | undefined, string | undefined, RegExp, string][] = [
      ["Parent", process.env.PARENT_EMAIL, process.env.PARENT_PASSWORD, /\/parent(\/|$)/, "/parent/announcements"],
      ["Student", process.env.STUDENT_EMAIL, process.env.STUDENT_PASSWORD, /\/student(\/|$)/, "/student/announcements"],
    ];
    for (const [label, email, password, home, href] of cases) {
      test.skip(!email || !password, `Set ${label.toUpperCase()}_EMAIL / _PASSWORD to run this check.`);
      const { context, page } = await loginAs(browser, email!, password!, home);
      try {
        await expect(navLink(page, "Announcements"), `${label} sidebar is missing Announcements`).toBeVisible();
        await page.goto(href);
        await expect(page.getByRole("heading", { name: "Announcements", exact: true })).toBeVisible();
        // Readers cannot publish.
        await expect(page.getByRole("button", { name: "New Announcement", exact: true })).toHaveCount(0);
      } finally {
        await context.close();
      }
    }
  });

  test("granting institutions.create surfaces the Add button for Supervisor", async ({ browser }) => {
    test.setTimeout(120_000);
    test.skip(!supEmail || !supPassword, "Set SUPERVISOR_EMAIL / SUPERVISOR_PASSWORD to run this check.");

    const admin = await adminContext(browser);
    const adminPage = await admin.newPage();
    try {
      await setRolePermission(adminPage, "Supervisor", "institutions.create", true);

      const granted = await loginAs(browser, supEmail!, supPassword!, /\/supervisor(\/|$)/);
      try {
        await granted.page.goto("/supervisor/institutions");
        await expect(granted.page.getByRole("button", { name: "Add Institution", exact: true })).toBeVisible();
        // ...and the API agrees — the button isn't decorative.
        const res = await granted.page.request.post("/api/institutions", { data: { name: uniqueName("rbac-inst-") } });
        expect(res.status()).toBe(201);
        const id = (await res.json()).data.id;
        await admin.request.delete(`/api/institutions/${id}`).catch(() => {});
      } finally {
        await granted.context.close();
      }
    } finally {
      await setRolePermission(adminPage, "Supervisor", "institutions.create", false).catch(() => {});
      await admin.close();
    }
  });
});
