import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/portal-token";
import { isStaff, setStaffSession, clearStaffSession } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://loutakis-website.vercel.app").replace(/\/$/, "");
}

/** The emailed link lands here: verify, set the session, go to the dashboard. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const payload = verifyToken(url.searchParams.get("t") ?? "");
  const email = payload?.a === "staff-signin" ? String(payload.c).toLowerCase() : null;

  if (!email || !isStaff(email)) {
    return NextResponse.redirect(`${siteUrl()}/staff?expired=1`);
  }
  setStaffSession(email);
  return NextResponse.redirect(`${siteUrl()}/staff`);
}

/** Sign out. */
export async function DELETE() {
  clearStaffSession();
  return NextResponse.json({ ok: true });
}
