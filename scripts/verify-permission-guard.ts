/**
 * Unit-level verification of the RBAC guard (getPermsForUser / getPerms).
 *
 * Runs directly against the real guard functions and the real DB (same
 * approach used to verify the Roles & Responsibilities seed earlier in this
 * project) rather than a mocking framework, since the guard's entire job is
 * to correctly resolve DB rows — mocking the DB would test nothing real.
 *
 * Two passes:
 *  1. Default matrix fidelity — for one seeded user per system role (with no
 *     custom AppRole assigned), the guard must resolve exactly to
 *     DEFAULT_MATRIX for every resource.
 *  2. Custom-override round trip — temporarily assigns a real Chief Mentor
 *     user a throwaway custom AppRole that flips "students.delete" from the
 *     Chief Mentor default (false) to true, confirms the guard picks up the
 *     override, then restores the user's original AppRole and deletes the
 *     throwaway role. This is the actual bug class from the bug report:
 *     confirming a permission CHANGE is reflected without any re-login.
 *
 * Run: npx tsx scripts/verify-permission-guard.ts
 */
import { PrismaClient, type Role } from "@prisma/client";
import { getPermsForUser } from "../src/lib/rbac-resolve";
import { DEFAULT_MATRIX, RESOURCES, SYSTEM_ROLE_NAMES, type PermSet } from "../src/lib/permission-data";

const prisma = new PrismaClient();

let checks = 0;
let failures = 0;

function eq(a: PermSet, b: PermSet) {
  return a.create === b.create && a.view === b.view && a.edit === b.edit && a.delete === b.delete;
}

function check(label: string, expected: PermSet, actual: PermSet) {
  checks++;
  if (!eq(expected, actual)) {
    failures++;
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function verifyDefaults() {
  console.log("--- Pass 1: default matrix fidelity (one user per system role) ---");
  for (const [role, label] of Object.entries(SYSTEM_ROLE_NAMES) as [Role, string][]) {
    const user = await prisma.user.findFirst({ where: { role, appRoleId: null } });
    if (!user) {
      console.log(`SKIP ${label}: no user with the default (unassigned custom-role) AppRole found`);
      continue;
    }
    const eff = await getPermsForUser(user.id);
    for (const r of RESOURCES) {
      check(`${label} / ${r.key}`, DEFAULT_MATRIX[role][r.key], eff.perms[r.key]);
    }
  }
}

async function verifyCustomOverrideRoundTrip() {
  console.log("--- Pass 2: custom AppRole override round trip ---");
  const chief = await prisma.user.findFirst({ where: { role: "CHIEF_MENTOR" } });
  if (!chief) {
    console.log("SKIP: no Chief Mentor user found to test an override against");
    return;
  }
  const originalAppRoleId = chief.appRoleId;
  const name = `__verify-guard-${Date.now()}`;

  try {
    // Chief Mentor's default is students.delete = false — flip it to true.
    const before = await getPermsForUser(chief.id);
    check("before override: students.delete should be false (Chief default)", { ...DEFAULT_MATRIX.CHIEF_MENTOR.students }, before.perms.students);

    const tempRole = await prisma.appRole.create({
      data: {
        name, baseRole: "CHIEF_MENTOR", isSystem: false,
        permissions: {
          create: RESOURCES.map((r) => ({
            resource: r.key,
            canCreate: r.key === "students" ? true : DEFAULT_MATRIX.CHIEF_MENTOR[r.key].create,
            canView: DEFAULT_MATRIX.CHIEF_MENTOR[r.key].view,
            canEdit: DEFAULT_MATRIX.CHIEF_MENTOR[r.key].edit,
            // The one deliberate override: students.delete false -> true.
            canDelete: r.key === "students" ? true : DEFAULT_MATRIX.CHIEF_MENTOR[r.key].delete,
          })),
        },
      },
    });
    await prisma.user.update({ where: { id: chief.id }, data: { appRoleId: tempRole.id } });

    const after = await getPermsForUser(chief.id);
    check(
      "after override: students.delete should now be true, with no re-login",
      { create: true, view: true, edit: true, delete: true },
      after.perms.students,
    );
    // Every other resource on the custom role should be untouched (still Chief Mentor defaults).
    for (const r of RESOURCES.filter((r) => r.key !== "students")) {
      check(`override side-effect check: ${r.key} unchanged`, DEFAULT_MATRIX.CHIEF_MENTOR[r.key], after.perms[r.key]);
    }
  } finally {
    await prisma.user.update({ where: { id: chief.id }, data: { appRoleId: originalAppRoleId } });
    await prisma.appRole.deleteMany({ where: { name } });
  }
}

async function main() {
  await verifyDefaults();
  await verifyCustomOverrideRoundTrip();

  console.log(`\n${checks - failures}/${checks} checks passed.`);
  await prisma.$disconnect();
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
