import { prisma } from "./db";
import { getSession } from "./auth";
import {
  DEFAULT_MATRIX, RESOURCES, SYSTEM_ROLE_NAMES,
  type Op, type PermSet, type ResourceKey,
} from "./permission-data";
import type { Role, RolePermission } from "@prisma/client";

const ALL_TRUE: PermSet = { create: true, view: true, edit: true, delete: true };

function rowToSet(row: RolePermission): PermSet {
  return { create: row.canCreate, view: row.canView, edit: row.canEdit, delete: row.canDelete };
}

export type EffectivePerms = {
  role: Role;
  appRoleId: string | null;
  perms: Record<ResourceKey, PermSet>;
};

/**
 * Resolve the effective permission matrix for a user.
 * - System "Super Admin" (or an enum SUPER_ADMIN with no custom role) is locked all-true.
 * - A user's custom AppRole rows override; missing rows fall back to the role's
 *   baseRole defaults, so newly added resources stay sensible.
 * Reads from the DB each call so role edits apply immediately (no stale JWT).
 */
export async function getPermsForUser(userId: string): Promise<EffectivePerms> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true, appRoleId: true,
      appRole: { select: { id: true, baseRole: true, isSystem: true, permissions: true } },
    },
  });
  if (!user) throw new Error("Unauthorized");

  let appRole = user.appRole;
  if (!appRole) {
    appRole = await prisma.appRole.findFirst({
      where: { isSystem: true, baseRole: user.role },
      select: { id: true, baseRole: true, isSystem: true, permissions: true },
    });
  }

  const base: Role = appRole?.baseRole ?? user.role;

  // Locked Super Admin: enum super with no role assigned, or the system Super Admin role.
  if (base === "SUPER_ADMIN" && (!appRole || appRole.isSystem)) {
    const perms = Object.fromEntries(RESOURCES.map((r) => [r.key, { ...ALL_TRUE }])) as Record<ResourceKey, PermSet>;
    return { role: user.role, appRoleId: appRole?.id ?? null, perms };
  }

  const rows = new Map((appRole?.permissions ?? []).map((row) => [row.resource, row]));
  const perms = Object.fromEntries(
    RESOURCES.map((r) => {
      const row = rows.get(r.key);
      return [r.key, row ? rowToSet(row) : { ...DEFAULT_MATRIX[base][r.key] }];
    }),
  ) as Record<ResourceKey, PermSet>;
  return { role: user.role, appRoleId: appRole?.id ?? null, perms };
}

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
