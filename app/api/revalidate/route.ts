import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

/**
 * Force a fresh pull from Box & Dice on demand.
 *  - Call this from a Box & Dice webhook (if available) when a listing changes,
 *  - or hit it on a schedule via Vercel Cron (see vercel.json).
 *
 * Protect it with a shared secret: /api/revalidate?secret=YOUR_SECRET
 */
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  revalidateTag("listings");
  return NextResponse.json({ ok: true, revalidated: "listings", now: Date.now() });
}
