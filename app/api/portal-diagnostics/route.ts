import { NextResponse } from "next/server";
import { getRawSalesListings } from "@/lib/boxdice";

/**
 * TEMPORARY — Phase 1 of the off-market portal plan. DELETE once the tag
 * convention is settled.
 *
 * Read-only, and deliberately AGGREGATE ONLY: counts and tag names, never
 * addresses, ids, prices or vendor detail. That's what makes it safe to leave
 * unauthenticated for the hour it exists — there is nothing here worth taking.
 *
 * It answers three questions the API documentation can't:
 *   1. Does Box & Dice return property.tags, and is anyone using tags today?
 *   2. Are the sensitivity / disclosure flags actually populated, or always false?
 *   3. How many listings would the portal-offmarket tag pick up right now?
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PORTAL_TAG = "portal-offmarket";

export async function GET() {
  let raw: any[];
  try {
    raw = await getRawSalesListings();
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Box & Dice fetch failed: ${String(err)}` },
      { status: 502 }
    );
  }

  if (raw.length === 0) {
    return NextResponse.json({
      ok: false,
      error:
        "No listings returned. Either USE_MOCK_DATA is true or BOXDICE_API_KEY is unset in this environment.",
    });
  }

  // Pagination can return an updated record more than once.
  const byId = new Map<string, any>();
  for (const r of raw) byId.set(String(r.id), r);
  const listings = [...byId.values()];

  // The headline question: what tags exist in the book today, and how often?
  const tagsInUse: Record<string, number> = {};
  for (const l of listings) {
    for (const t of l.property?.tags ?? []) {
      const key = String(t);
      tagsInUse[key] = (tagsInUse[key] ?? 0) + 1;
    }
  }

  const count = (fn: (l: any) => boolean) => listings.filter(fn).length;
  const tagged = listings.filter((l) => (l.property?.tags ?? []).includes(PORTAL_TAG));

  // Which website_status values are actually in use — tells us whether the
  // portal can lean on status at all, or must rely on tags alone.
  const websiteStatuses: Record<string, number> = {};
  for (const l of listings) {
    const key = String(l.website_status ?? "(null)");
    websiteStatuses[key] = (websiteStatuses[key] ?? 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    totals: {
      listings: listings.length,
      withAnyTag: count((l) => (l.property?.tags ?? []).length > 0),
      situationVerySensitive: count((l) => l.situation_very_sensitive === true),
      hidden: count((l) => l.hidden === true),
      addressUndisclosed: count((l) => l.address_undisclosed === true),
      suburbUndisclosed: count((l) => l.suburb_undisclosed === true),
      priceUndisclosed: count((l) => l.price_undisclosed === true),
      withConsultants: count((l) => (l.consultant_ids ?? []).length > 0),
      withMultipleConsultants: count((l) => (l.consultant_ids ?? []).length > 1),
    },
    tagsInUse,
    websiteStatuses,
    portalTag: {
      looksFor: PORTAL_TAG,
      matches: tagged.length,
      wouldShowAfterExclusions: tagged.filter(
        (l) => l.situation_very_sensitive !== true && l.hidden !== true
      ).length,
    },
  });
}
