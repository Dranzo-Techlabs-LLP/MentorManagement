import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { ROUTE_GUARD, ROLE_HOME } from "@/lib/rbac";
import type { Role } from "@prisma/client";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev_insecure_secret_change_me",
);

const PROTECTED_PREFIXES = ["/admin", "/chief", "/supervisor", "/mentor", "/parent", "/student", "/account"];

async function readSession(req: NextRequest) {
  const token = req.cookies.get("eu_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as { userId: string; role: Role };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (!isProtected) return NextResponse.next();

  const session = await readSession(req);
  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const guard = ROUTE_GUARD.find(
    (g) => pathname === g.prefix || pathname.startsWith(g.prefix + "/"),
  );
  if (guard && !guard.roles.includes(session.role)) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/chief/:path*", "/supervisor/:path*", "/mentor/:path*", "/parent/:path*", "/student/:path*", "/account/:path*"],
};
