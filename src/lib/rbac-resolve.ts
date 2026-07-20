import { prisma } from "./db";
import {
  DEFAULT_MATRIX, RESOURCES,
  type PermSet, type ResourceKey,
} from "./permission-data";
import type { Role, RolePermission } from "@prisma/client";

/**
 * Pure DB → permission-matrix resolution for a known user id. Deliberately
 * has no dependency on the current request/session (unlike requirePermission/
 * getPerms in permissions.ts, which need `getSession`) so it can be imported
 * by non-Next.js contexts too — e.g. scripts/verify-permission-guard.ts,
 * prisma/seed.ts — without pulling in `server-only` via lib/auth.ts.
 */

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
