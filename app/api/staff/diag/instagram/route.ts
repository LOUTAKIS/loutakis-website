import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
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
 *   /api/staff/diag/instagram             what Instagram says right now
 *   /api/staff/diag/instagram?refresh=1   …and throw away the cached feed first
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

  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  if (refresh) {
    revalidateTag("instagram");
    revalidatePath("/about");
  }

  return NextResponse.json({ purgedCache: refresh, ...(await instagramDiagnostics()) });
}
