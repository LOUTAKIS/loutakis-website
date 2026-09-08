import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { getStaff } from "@/lib/staff-auth";
import { instagramDiagnostics, refreshInstagramToken } from "@/lib/instagram";

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
 *   /api/staff/diag/instagram                  what Instagram says right now
 *   /api/staff/diag/instagram?refresh=1        …and throw away the cached feed first
 *   /api/staff/diag/instagram?refreshToken=1   …and renew the 60-day token now
 *
 * refreshToken exists because the renewal is the one part of this that fails
 * silently and expensively. The nightly cron does it unattended; if the write
 * to the token store were broken we would not find out until the token expired
 * sixty days later, at which point it cannot be recovered without going back to
 * Meta. This runs the same code on demand and says what happened.
 *
 * The refresh matters more than it looks. `unstable_cache` keeps its entry in
 * Vercel's Data Cache, which OUTLIVES a deployment — so a build that ran
 * before the token existed caches an empty feed, and every later build happily
 * reuses that emptiness for the full hour. Purging the tag is what breaks that
 * loop; redeploying alone does not.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!getStaff()) {
    return NextResponse.json({ ok: false, error: "Sign in at /staff first" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;

  const refresh = params.get("refresh") === "1";
  if (refresh) {
    revalidateTag("instagram");
    revalidatePath("/about");
  }

  // Meta refuses a token less than 24 hours old, so a failure here on the day
  // the token was issued is expected and says so in `detail` — it is not the
  // same as the store write failing.
  const tokenRefresh = params.get("refreshToken") === "1" ? await refreshInstagramToken() : null;

  return NextResponse.json({
    purgedCache: refresh,
    ...(tokenRefresh ? { tokenRefresh } : {}),
    ...(await instagramDiagnostics()),
  });
}
