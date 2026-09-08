import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { getStaff } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pull from Box & Dice now, rather than waiting for the next 10-minute refresh.
 *
 * There is already /api/revalidate, but it is guarded by a shared secret in the
 * query string — fine for a cron job, wrong for a person: a secret typed into
 * an address bar ends up in browser history, in screen shares, and eventually
 * in somebody's chat message. This does the same job behind the staff session
 * that is already signed in.
 *
 * Purging the tag is what matters. The listings live in Vercel's Data Cache
 * under the "listings" tag, which outlives a deployment, so redeploying does
 * NOT pick up a change made in the CRM two minutes ago. Only the purge does.
 */
export async function POST() {
  const staff = getStaff();
  if (!staff) {
    return NextResponse.json({ ok: false, error: "Sign in at /staff first" }, { status: 401 });
  }

  revalidateTag("listings");
  // The pages that render listings and are cached in their own right.
  revalidatePath("/");
  revalidatePath("/properties");

  console.log(`[refresh] listings purged by ${staff.email}`);
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
