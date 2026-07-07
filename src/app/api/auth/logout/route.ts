import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST() {
  await destroySession();
  // Relative Location + 303 → the browser resolves it against the current
  // origin (works behind a reverse proxy and in dev; avoids wrong host/scheme),
  // and 303 makes the follow-up request a GET.
  return new NextResponse(null, { status: 303, headers: { Location: "/login" } });
}
