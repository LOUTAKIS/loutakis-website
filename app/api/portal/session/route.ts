import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/portal-token";
import { setSession, clearSession } from "@/lib/portal-session";
import { recordActivity } from "@/lib/portal-activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The sign-in link lands here: verify it, set the session, go to their account. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const payload = verifyToken(url.searchParams.get("t") ?? "");

  if (!payload || payload.a !== "signin") {
    return NextResponse.redirect(new URL("/portal/signin?expired=1", url.origin));
  }

  setSession(payload.c);
  await recordActivity(payload.c, { k: "signin" });
  return NextResponse.redirect(new URL("/portal", url.origin));
}

/** Sign out. */
export async function DELETE() {
  clearSession();
  return NextResponse.json({ ok: true });
}
