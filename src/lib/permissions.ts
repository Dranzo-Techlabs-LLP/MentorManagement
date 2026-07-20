import { prisma } from "./db";
import { getSession } from "./auth";
import { DEFAULT_MATRIX, RESOURCES, SYSTEM_ROLE_NAMES } from "./permission-data";
import type { Op, PermSet, ResourceKey } from "./permission-data";
import type { Role } from "@prisma/client";

export { getPermsForUser, type EffectivePerms } from "./rbac-resolve";
import { getPermsForUser } from "./rbac-resolve";

/** Guard for server actions & API routes: session + resource permission, or throw. */
export async function requirePermission(resource: ResourceKey, op: Op) {
  const sess = await getSession();
  if (!sess) throw new Error("Unauthorized");
  const eff = await getPermsForUser(sess.userId);
  if (!eff.perms[resource][op]) throw new Error("Forbidden");
  return sess;
}

/** Permission set for one resource for the current session (for conditional UI). */
export async function getPerms(resource: ResourceKey): Promise<PermSet> {
  const sess = await getSession();
  if (!sess) return { create: false, view: false, edit: false, delete: false };
  const eff = await getPermsForUser(sess.userId);
  return eff.perms[resource];
}

/** Strict gate for the Roles & Responsibilities screen: unrestricted Super Admin only. */
export async function requireSuperAdmin() {
  const sess = await getSession();
  if (!sess) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({
    where: { id: sess.userId },
    select: { role: true, appRole: { select: { isSystem: true, baseRole: true } } },
  });
  if (!user || user.role !== "SUPER_ADMIN") throw new Error("Forbidden");
  if (user.appRole && !(user.appRole.isSystem && user.appRole.baseRole === "SUPER_ADMIN")) {
    throw new Error("Forbidden");
  }
  return sess;
}

/** Idempotent: creates the six system roles with their default matrices on first run. */
export async function ensureRbacSeeded() {
  const count = await prisma.appRole.count();
  if (count > 0) return;
  for (const [role, name] of Object.entries(SYSTEM_ROLE_NAMES) as [Role, string][]) {
    await prisma.appRole.create({
      data: {
        name, baseRole: role, isSystem: true,
        permissions: {
          create: RESOURCES.map((r) => ({
            resource: r.key,
            canCreate: DEFAULT_MATRIX[role][r.key].create,
            canView: DEFAULT_MATRIX[role][r.key].view,
            canEdit: DEFAULT_MATRIX[role][r.key].edit,
            canDelete: DEFAULT_MATRIX[role][r.key].delete,
          })),
        },
      },
    });
  }
}
