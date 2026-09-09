import { NextResponse } from "next/server";
import { getStaff } from "@/lib/staff-auth";
import { getRawSalesListings, getPropertyCategories } from "@/lib/boxdice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Can we reproduce realestate.com.au's performance figures from our own CRM?
 *
 * Read-only, and it publishes nothing. The point is to answer three questions
 * before a single number goes on the Sell with us page:
 *
 *  1. HOW MANY SALES ARE THERE, REALLY? The public site only shows listings
 *     whose "My Website Status" is Current or Sold — a dropdown someone has to
 *     set. This reads the RAW feed, so `missingWebsiteStatus` counts sales the
 *     website has never known about.
 *
 *  2. WHICH DATE MEANS "ADVERTISED"? `date_listed` appears to be when the
 *     authority was signed, not when the campaign went live — 32 Gent was
 *     listed 9 Jun for an 18 Jul auction. If `campaign_start_date` is
 *     populated, it is the honest basis for days on market. Both are reported
 *     so the difference is visible rather than assumed.
 *
 *  3. DO OUR NUMBERS MATCH REA'S? Their published card is included below, so
 *     the comparison is on one screen. If we cannot match it, we should not
 *     derive these figures at all — we should publish REA's and attribute them.
 */

/** What REA showed on the agency profile, for side-by-side comparison. */
const REA_PUBLISHED = {
  capturedOn: "2026-09-09",
  window: "last 12 months",
  total: { sold: 40, medianPrice: 908_000 },
  byType: {
    House: { sold: 26, medianPrice: 985_000, medianDays: 20.5 },
    Townhouse: { sold: 11, medianPrice: 790_000, medianDays: 21 },
    Apartment: { sold: 3, medianPrice: 400_000, medianDays: 20 },
  },
};

function median(values: number[]): number | null {
  const xs = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = xs.length >> 1;
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

function days(from: unknown, to: unknown): number | null {
  const a = Date.parse(String(from ?? ""));
  const b = Date.parse(String(to ?? ""));
  if (isNaN(a) || isNaN(b)) return null;
  const d = (b - a) / 86_400_000;
  // A negative span means the dates disagree about reality; report nothing
  // rather than dragging a median down with an impossible number.
  return d >= 0 && d < 3650 ? d : null;
}

export async function GET(req: Request) {
  if (!getStaff()) {
    return NextResponse.json({ ok: false, error: "Sign in at /staff first" }, { status: 401 });
  }

  const months = Number(new URL(req.url).searchParams.get("months") ?? 12);
  // Floored to the day — see lib/sales-stats for why this matters.
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  since.setUTCHours(0, 0, 0, 0);

  let raw: any[] = [];
  let categories = new Map<number, string>();
  try {
    [raw, categories] = await Promise.all([getRawSalesListings(), getPropertyCategories()]);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "CRM read failed" },
      { status: 502 }
    );
  }

  /**
   * Sold, counted at the sale date rather than settlement — which is how REA
   * and every other agent reports, so the numbers are comparable.
   */
  // De-duplicated the same way as lib/sales-stats: a record edited mid-page
  // comes back twice, and a duplicate silently inflates every figure here.
  const unique = [...new Map(raw.map((r) => [String(r?.id ?? Math.random()), r])).values()];

  const sold = unique.filter((r) => {
    const t = Date.parse(String(r?.sale_date ?? ""));
    return !isNaN(t) && t >= +since;
  });

  const categoryName = (r: any): string => {
    const id = Number(r?.property?.property_category_id);
    return categories.get(id) || (id ? `category ${id}` : "unclassified");
  };

  const rows = sold.map((r) => ({
    address: [r?.property?.number, r?.property?.street_name, r?.property?.street_type, r?.property?.suburb]
      .filter(Boolean)
      .join(" "),
    category: categoryName(r),
    salePrice: Number(r?.sale_price) || null,
    priceUndisclosed: r?.price_undisclosed === true,
    saleStatus: r?.sale_status ?? null,
    websiteStatus: r?.website_status ?? null,
    dateListed: r?.date_listed ?? null,
    campaignStart: r?.campaign_start_date ?? null,
    saleDate: r?.sale_date ?? null,
    daysFromListed: days(r?.date_listed, r?.sale_date),
    daysFromCampaignStart: days(r?.campaign_start_date, r?.sale_date),
  }));

  const summarise = (set: typeof rows) => ({
    sold: set.length,
    medianPrice: median(set.map((x) => x.salePrice ?? 0)),
    medianDaysFromListed: median(set.map((x) => x.daysFromListed ?? 0)),
    medianDaysFromCampaignStart: median(set.map((x) => x.daysFromCampaignStart ?? 0)),
    withoutPrice: set.filter((x) => !x.salePrice).length,
    undisclosed: set.filter((x) => x.priceUndisclosed).length,
  });

  const byType: Record<string, ReturnType<typeof summarise>> = {};
  for (const name of new Set(rows.map((r) => r.category))) {
    byType[name] = summarise(rows.filter((r) => r.category === name));
  }

  return NextResponse.json({
    window: `${months} months, sales on or after ${since.toISOString().slice(0, 10)}`,
    crmTotalRecords: raw.length,
    duplicatesInFeed: raw.length - unique.length,

    ours: { total: summarise(rows), byType },
    rea: REA_PUBLISHED,

    /**
     * The two questions this exists to answer, stated plainly rather than left
     * for the reader to derive from the numbers above.
     */
    checks: {
      campaignStartPopulated: `${rows.filter((r) => r.campaignStart).length} of ${rows.length}`,
      missingWebsiteStatus: rows.filter(
        (r) => !["current", "sold"].includes(String(r.websiteStatus ?? "").toLowerCase())
      ).length,
      countGapVsRea: REA_PUBLISHED.total.sold - rows.length,
      categoriesSeen: [...new Set(rows.map((r) => r.category))],
    },

    // Every sale behind the numbers, so any figure can be checked by hand.
    rows: rows.sort((a, b) => String(b.saleDate).localeCompare(String(a.saleDate))),
  });
}
