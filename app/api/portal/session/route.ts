import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/portal-token";
import { setSession } from "@/lib/portal-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The sign-in link lands here: verify it, set the session cookie, go to the list. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const payload = verifyToken(url.searchParams.get("t") ?? "");

  if (!payload || payload.a !== "signin") {
    return NextResponse.redirect(new URL("/portal/signin?expired=1", url.origin));
  }

  setSession(payload.c);
  return NextResponse.redirect(new URL("/portal", url.origin));
}
