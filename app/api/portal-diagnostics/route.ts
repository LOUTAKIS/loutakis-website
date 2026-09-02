import { NextResponse } from "next/server";
import { getRawSalesListings } from "@/lib/boxdice";

/**
 * TEMPORARY — Phase 1 of the off-market portal plan. DELETE once we've settled
 * the tag convention.
 *
 * Read-only. Answers three questions we can't answer from the docs alone:
 *   1. Does Box & Dice actually return property.tags, and what's in use today?
 *   2. Do the fields the portal depends on come through populated?
 *   3. Which listings would a portal-offmarket tag currently pick up?
 *
 * Protected by PORTAL_DIAG_SECRET because it exposes listings the public site
 * deliberately hides — including anything marked sensitive.
 *
 *   /api/portal-diagnostics?secret=YOUR_SECRET
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PORTAL_TAG = "portal-offmarket";

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  const expected = process.env.PORTAL_DIAG_SECRET;

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "PORTAL_DIAG_SECRET is not set in this environment." },
      { status: 503 }
    );
  }
  if (secret !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let raw: any[];
  try {
    raw = await getRawSalesListings();
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Box & Dice fetch failed: ${String(err)}` },
      { status: 502 }
    );
  }

  // De-dupe: pagination can return an updated record more than once.
  const byId = new Map<string, any>();
  for (const r of raw) byId.set(String(r.id), r);
  const listings = [...byId.values()];

  // Every distinct tag in use across the book, with counts. This is the
  // question that matters: is anyone tagging anything already?
  const tagCounts: Record<string, number> = {};
  for (const l of listings) {
    for (const t of l.property?.tags ?? []) {
      const key = String(t);
      tagCounts[key] = (tagCounts[key] ?? 0) + 1;
    }
  }

  const address = (p: any = {}) =>
    [p.unit ? `${p.unit}/` : "", p.number, p.street_name, p.street_type, p.suburb]
      .filter(Boolean)
      .join(" ")
      .replace(" /", "/")
      .trim();

  const rows = listings.map((l) => ({
    id: String(l.id),
    address: address(l.property),
    status: l.status ?? null,
    website_status: l.website_status ?? null,
    tags: l.property?.tags ?? [],
    hidden: l.hidden === true,
    situation_very_sensitive: l.situation_very_sensitive === true,
    address_undisclosed: l.address_undisclosed === true,
    suburb_undisclosed: l.suburb_undisclosed === true,
    price_undisclosed: l.price_undisclosed === true,
    under_offer: l.under_offer === true,
    images: (l.images ?? []).length,
    consultants: (l.consultant_ids ?? []).length,
  }));

  const tagged = rows.filter((r) => r.tags.includes(PORTAL_TAG));

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    totals: {
      listings: rows.length,
      withAnyTag: rows.filter((r) => r.tags.length > 0).length,
      sensitive: rows.filter((r) => r.situation_very_sensitive).length,
      hidden: rows.filter((r) => r.hidden).length,
      addressUndisclosed: rows.filter((r) => r.address_undisclosed).length,
    },
    // The headline answer: does the tags field carry anything at all?
    tagsInUse: tagCounts,
    portalTag: {
      looksFor: PORTAL_TAG,
      matches: tagged.length,
      // What the portal WOULD show today, after the two hard exclusions.
      wouldShow: tagged
        .filter((r) => !r.situation_very_sensitive && !r.hidden)
        .map((r) => r.address),
      excludedAsSensitive: tagged.filter((r) => r.situation_very_sensitive).map((r) => r.address),
    },
    listings: rows,
  });
}
