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

/**
 * The off-market marker is the Box & Dice Listing Tag named "Off Market"
 * (Settings → Listings → Listing Tags). Listing Tags are a managed list, so the
 * value is consistent when applied — but we normalise anyway, so renaming it to
 * "Off-Market" or "off market" later doesn't silently empty the portal.
 */
const PORTAL_TAG = "Off Market";
const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const PORTAL_TAG_NORM = norm(PORTAL_TAG);
const hasPortalTag = (l: any) =>
  (l.property?.tags ?? []).some((t: unknown) => norm(t) === PORTAL_TAG_NORM);

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
  const tagged = listings.filter(hasPortalTag);

  // Which website_status values are actually in use — tells us whether the
  // portal can lean on status at all, or must rely on tags alone.
  const websiteStatuses: Record<string, number> = {};
  for (const l of listings) {
    const key = String(l.website_status ?? "(null)");
    websiteStatuses[key] = (websiteStatuses[key] ?? 0) + 1;
  }

  // Is the purpose-built custom-category field free? If it is, it's a cleaner
  // home for the off-market marker than overloading tags, which are already
  // carrying property type and may feed the portal exports.
  const otherCategories: Record<string, number> = {};
  const categories: Record<string, number> = {};
  for (const l of listings) {
    const oc = String(l.property?.property_other_category_id ?? "(none)");
    otherCategories[oc] = (otherCategories[oc] ?? 0) + 1;
    const c = String(l.property?.property_category_id ?? "(none)");
    categories[c] = (categories[c] ?? 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    otherCategoryIdsInUse: otherCategories,
    categoryIdsInUse: categories,
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
