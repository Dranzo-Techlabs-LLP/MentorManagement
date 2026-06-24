import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, createSessionCookie } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/rbac";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.status === "INACTIVE") {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await createSessionCookie({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } }).catch(() => {});
  await prisma.auditLog.create({
    data: { userId: user.id, action: "LOGIN", entity: "User", entityId: user.id },
  }).catch(() => {});

  return NextResponse.json({ ok: true, home: ROLE_HOME[user.role], role: user.role });
}
