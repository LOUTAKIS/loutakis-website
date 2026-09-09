import "server-only";
import { unstable_cache } from "next/cache";
import { getRawSalesListings, getPropertyCategories } from "./boxdice";

/**
 * Our market performance, for the Sell with us page.
 *
 * COMPUTED FROM OUR OWN CRM, and it reproduces realestate.com.au exactly.
 * Reconciled 9 Sep 2026 over a rolling 12 months:
 *
 *              ours              REA
 *   House      26 · $985,000     26 · $985k
 *   Townhouse  11 · $790,000     11 · $790k
 *   Apartment   3 · $400,000      3 · $400k
 *   Total      40 · $907,500     40 · $908k
 *
 * It did not agree at first — we had 39 sales and a $935,000 median. The cause
 * was a window starting at the current time of day rather than midnight, which
 * dropped 15a McArthurs Road (sold 9 Sep 2025, $790,000) by 41 minutes. See
 * `since` below; that one sale was also REA's eleventh townhouse and their
 * exact townhouse median.
 *
 * DAYS ADVERTISED IS NOT COMPUTED HERE, and cannot be. `date_listed` is when
 * the authority was signed, not when advertising began, and
 * `campaign_start_date` is empty on every sale. Measured from the authority our
 * median is 50 days against REA's 20.5 — a different measurement, not a
 * rounding difference, and publishing it as "days advertised" would be false.
 * That column alone comes from lib/rea-stats, read off REA by hand.
 */

export type TypeStats = {
  type: string;
  sold: number;
  medianPrice: number | null;
};

export type SalesStats = {
  windowMonths: number;
  since: string;
  totalSold: number;
  medianPrice: number | null;
  byType: TypeStats[];
  computedAt: string;
};

/** REA's own order, so the two cards read the same way down the page. */
const TYPE_ORDER = ["House", "Townhouse", "Apartment"];

function median(values: number[]): number | null {
  const xs = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = xs.length >> 1;
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

async function compute(months: number): Promise<SalesStats> {
  /**
   * Midnight, not "this time of day twelve months ago".
   *
   * Box & Dice stores sale_date as a plain date, which parses to midnight. A
   * window starting at the current time of day therefore drops any sale that
   * happened exactly twelve months ago — 15a McArthurs Road sold on 9 Sep 2025
   * for $790,000 and was excluded by 41 minutes, which cost us a townhouse and
   * put our median $17,500 away from REA's. With the window floored to the day,
   * our figures reproduce REA's card exactly.
   */
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  since.setUTCHours(0, 0, 0, 0);

  const [raw, categories] = await Promise.all([getRawSalesListings(), getPropertyCategories()]);

  /**
   * Counted at the sale date, not settlement — which is how REA and every
   * other agent reports, so a vendor comparing the two is comparing like
   * with like.
   */
  const sold = raw.filter((r) => {
    const t = Date.parse(String(r?.sale_date ?? ""));
    return !isNaN(t) && t >= +since;
  });

  /**
   * Undisclosed prices are counted in the median but never displayed — the
   * median is a statistic about the market, not a disclosure of any one
   * vendor's price, and excluding them would misrepresent the middle.
   */
  const priced = (rows: any[]) => rows.map((r) => Number(r?.sale_price) || 0);

  const typeOf = (r: any): string => {
    const id = Number(r?.property?.property_category_id);
    return categories.get(id) || "Other";
  };

  const seen = new Map<string, any[]>();
  for (const r of sold) {
    const t = typeOf(r);
    seen.set(t, [...(seen.get(t) ?? []), r]);
  }

  const byType = [...seen.entries()]
    .map(([type, rows]) => ({ type, sold: rows.length, medianPrice: median(priced(rows)) }))
    .sort((a, b) => {
      const ai = TYPE_ORDER.indexOf(a.type);
      const bi = TYPE_ORDER.indexOf(b.type);
      // Anything REA doesn't publish sinks below the three it does.
      if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      return b.sold - a.sold;
    });

  return {
    windowMonths: months,
    since: since.toISOString().slice(0, 10),
    totalSold: sold.length,
    medianPrice: median(priced(sold)),
    byType,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Cached for six hours. The figures move when a sale settles, not by the
 * minute, and the raw feed is the whole sales collection — not something to
 * pull on every page view of a page we want people to share.
 */
const cached = unstable_cache((months: number) => compute(months), ["sales-stats"], {
  revalidate: 60 * 60 * 6,
  tags: ["listings", "sales-stats"],
});

export async function getSalesStats(months = 12): Promise<SalesStats | null> {
  try {
    return await cached(months);
  } catch (err) {
    // A page that quietly drops the section beats one that fails to render, and
    // half-figures would be worse than none: these are performance claims.
    console.error("[sales-stats] unavailable", err);
    return null;
  }
}

/** "$985k", the way REA writes it. */
export function shortPrice(n: number | null): string {
  if (!n) return "—";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2).replace(/0$/, "")}m`;
  }
  return `$${Math.round(n / 1000)}k`;
}
