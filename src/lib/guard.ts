import { getSession } from "./auth";
import type { Role } from "@prisma/client";

export async function requireSession() {
  const s = await getSession();
  if (!s) throw new Error("Unauthorized");
  return s;
}

export async function requireRole(...roles: Role[]) {
  const s = await requireSession();
  if (!roles.includes(s.role)) throw new Error("Forbidden");
  return s;
}
