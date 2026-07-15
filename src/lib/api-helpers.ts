import { NextResponse } from "next/server";

/** Maps guard.ts's thrown Errors ("Unauthorized"/"Forbidden") to proper HTTP status codes. */
export function apiError(e: unknown) {
  const message = e instanceof Error ? e.message : "Something went wrong.";
  const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
  return NextResponse.json({ ok: false, error: message }, { status });
}
