import { NextResponse } from "next/server";
import { searchSuburbs } from "@/lib/suburbs";

/**
 * Suburb autocomplete for the portal registration form.
 *
 * Reads a committed VIC suburb map (built once by scripts/bd-suburbs.mjs) — it
 * never calls Box & Dice, so it can't be rate-limited and costs nothing. The
 * whole list is ~3,000 entries; sending it to the browser would be a needless
 * payload on a form most visitors never open, so the matching happens here and
 * only the top few results go over the wire.
 */
export const runtime = "nodejs";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ suburbs: [] });

  return NextResponse.json(
    { suburbs: searchSuburbs(q, 8) },
    // The map only changes when we re-run the crawl, so let it cache hard.
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } }
  );
}
