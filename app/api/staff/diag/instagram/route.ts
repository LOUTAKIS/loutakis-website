import { NextResponse } from "next/server";
import { getStaff } from "@/lib/staff-auth";
import { instagramDiagnostics } from "@/lib/instagram";

/**
 * Why isn't the Instagram row showing?
 *
 * The feed hides itself on every failure, which is right for visitors and
 * useless for us — a blank section looks identical whether the token is
 * missing, expired, or pointed at the wrong account. This says which.
 *
 * Staff sign-in only, and it never returns the token itself: only whether one
 * exists, where it came from, and what Instagram said back.
 *
 *   /api/staff/diag/instagram
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!getStaff()) {
    return NextResponse.json({ ok: false, error: "Sign in at /staff first" }, { status: 401 });
  }
  return NextResponse.json(await instagramDiagnostics());
}
