import "server-only";
import { unstable_cache } from "next/cache";
import { getRawSalesListings, getPropertyCategories } from "./boxdice";

/**
 * Our market performance, for the Sell with us page.
 *
 * WHY THESE FIGURES AND NOT OTHERS. Reconciled against realestate.com.au on
 * 9 Sep 2026, from the raw CRM feed over a rolling 12 months:
 *
 *              ours                REA
 *   House      26 · $985,000       26 · $985k     exact
 *   Apartment   3 · $400,000        3 · $400k     exact
 *   Townhouse  10 · $772,500       11 · $790k     one sale adrift
 *   Total      39 · $935,000       40 · $908k
 *
 * A single townhouse sale between roughly $790k and $880k reconciles every
 * remaining figure to the dollar — almost certainly one sale sitting a few days
 * either side of REA's window boundary. So counts and medians are computed
 * here, from our own records, and they agree with what a vendor sees on REA.
 *
 * DAYS ADVERTISED IS NOT COMPUTED HERE, and cannot be. The CRM's `date_listed`
 * is when the authority was signed, not when advertising began, and
 * `campaign_start_date` was empty on all 39 sales. Measured from the authority
 * our median is 50 days against REA's 20.5 — a different thing entirely, not a
 * rounding difference. Publishing it as "days advertised" would be false. That
 * column comes from lib/rea-stats.ts, entered by hand and attributed to REA,
 * until we have enough of our own advertising-start dates to do it properly.
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
  const since = new Date();
  since.setMonth(since.getMonth() - months);

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
