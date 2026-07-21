/**
 * Audit: can every permission the Roles & Responsibilities screen is allowed
 * to grant actually reach the user's sidebar?
 *
 * The nav is a per-role list that the layout filters DOWN by permission, so a
 * role with no entry for a resource can never be granted visibility no matter
 * what the matrix says. This script finds those dead ends.
 *
 *   npx tsx scripts/audit-nav-coverage.ts
 */
import { NAV } from "../src/lib/rbac";
import { RESOURCES, DEFAULT_MATRIX, NAV_RESOURCE, type ResourceKey } from "../src/lib/permission-data";
import type { Role } from "@prisma/client";

const ROLES: Role[] = ["SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR", "MENTOR", "PARENT", "STUDENT"];
const LABEL = new Map(RESOURCES.map((r) => [r.key, r.label]));

/**
 * Sub-resources rendered inside another page rather than as their own section,
 * so having no sidebar entry is correct rather than a gap.
 */
const NON_NAV_RESOURCES = new Set<ResourceKey>([
  "portfolio", // goals/tasks/records/docs live inside the student detail page
]);

/**
 * Policy: which workspace roles may ever hold a resource. Anything outside
 * this is deliberately unavailable — e.g. a Student must never be given
 * Users Management, and System Logs / Settings stay Super Admin only.
 * A gap INSIDE this policy is a bug; outside it is by design.
 */
const MAY_HOLD: Record<ResourceKey, Role[]> = {
  students: ["SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR", "MENTOR"],
  portfolio: ROLES,
  mentors: ["SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR"],
  parents: ["SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR", "MENTOR"],
  users: ["SUPER_ADMIN", "CHIEF_MENTOR"],
  institutions: ["SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR", "MENTOR"],
  applications: ["SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR"],
  mentor_applications: ["SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR"],
  sessions: ["SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR", "MENTOR"],
  assessments: ROLES,
  reports: ["SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR", "MENTOR", "PARENT"],
  announcements: ROLES,
  messages: ROLES,
  feedback: ["SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR", "MENTOR", "PARENT"],
  logs: ["SUPER_ADMIN"],
  settings: ["SUPER_ADMIN"],
};

type Gap = { role: Role; resource: ResourceKey; defaultView: boolean };

const brokenNow: Gap[] = [];
const inPolicyLatent: Gap[] = [];
const byDesign: Gap[] = [];

for (const role of ROLES) {
  const reachable = new Set<ResourceKey>();
  for (const item of NAV[role]) {
    const res = NAV_RESOURCE[item.href];
    if (res) reachable.add(res);
  }

  for (const r of RESOURCES) {
    if (reachable.has(r.key) || NON_NAV_RESOURCES.has(r.key)) continue;
    const gap: Gap = { role, resource: r.key, defaultView: DEFAULT_MATRIX[role][r.key].view };
    if (!MAY_HOLD[r.key].includes(role)) byDesign.push(gap);
    else if (gap.defaultView) brokenNow.push(gap);
    else inPolicyLatent.push(gap);
  }
}

const line = (g: Gap) => `    ${g.role.padEnd(14)} ${String(LABEL.get(g.resource))}`;

console.log("=".repeat(78));
console.log("NAV COVERAGE AUDIT");
console.log("=".repeat(78));

console.log(`\n[A] BROKEN — granted by default, but no sidebar entry exists (${brokenNow.length}):`);
console.log(brokenNow.length ? brokenNow.map(line).join("\n") : "    (none)");

console.log(`\n[B] IN-POLICY GAP — grantable to this role, but no sidebar entry (${inPolicyLatent.length}):`);
console.log(inPolicyLatent.length ? inPolicyLatent.map(line).join("\n") : "    (none)");

console.log(`\n[C] BY DESIGN — resource is deliberately out of scope for this role (${byDesign.length}):`);
const byRole = new Map<Role, ResourceKey[]>();
for (const g of byDesign) byRole.set(g.role, [...(byRole.get(g.role) ?? []), g.resource]);
for (const [role, keys] of byRole) console.log(`    ${role.padEnd(14)} ${keys.join(", ")}`);

const failures = brokenNow.length + inPolicyLatent.length;
console.log("\n" + "=".repeat(78));
console.log(`${failures === 0 ? "PASS" : "FAIL"} — ${brokenNow.length} broken, ${inPolicyLatent.length} in-policy gaps, ${byDesign.length} by design`);
console.log("=".repeat(78));

process.exit(failures === 0 ? 0 : 1);
