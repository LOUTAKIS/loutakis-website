import "server-only";
import { unstable_cache } from "next/cache";
import { getRawSalesListings, getPropertyCategories } from "./boxdice";

/**
 * Our market performance, for the Sell with us page. Nothing is entered by
 * hand; every figure here is computed from Box & Dice and updates itself.
 *
 * Reconciled against realestate.com.au on 9 Sep 2026 over a rolling 12 months,
 * and it reproduces their card exactly:
 *
 *              ours              REA
 *   House      26 · $985,000     26 · $985k
 *   Townhouse  11 · $790,000     11 · $790k
 *   Apartment   3 · $400,000      3 · $400k
 *   Total      40 · $907,500     40 · $908k
 *
 * It did not agree at first — 39 sales and a $935,000 median. The cause was a
 * window starting at the current time of day rather than midnight, which
 * dropped 15a McArthurs Road (sold 9 Sep 2025, $790,000) by 41 minutes. That
 * one sale was REA's eleventh townhouse and their exact townhouse median.
 *
 * DAYS ADVERTISED — see ONLINE_DATE_FROM. `date_listed` historically recorded
 * when the authority was signed rather than when advertising began, so days
 * measured from it came out at 50 against REA's 20.5: a different measurement,
 * not a rounding difference. The convention is changing, so this counts only
 * sales listed on or after the changeover and shows nothing until enough of
 * them exist. No date is ever mixed with one that means something else.
 */

export type TypeStats = {
  type: string;
  sold: number;
  medianPrice: number | null;
  /** Null until enough sales carry a real advertising-start date. */
  medianDays: number | null;
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

/**
 * The day `date_listed` started meaning "went online" rather than "authority
 * signed". Set LISTING_ONLINE_DATE_FROM (YYYY-MM-DD) in Vercel once the CRM
 * convention has changed; until then no days figure is computed or shown,
 * because the only honest answer is that we do not know.
 */
const ONLINE_DATE_FROM = process.env.LISTING_ONLINE_DATE_FROM ?? "";

/**
 * Below this, a median is an anecdote. A "median days" drawn from two sales
 * would be worse than showing nothing, so the column stays hidden until a type
 * has at least this many qualifying sales.
 */
const MIN_FOR_DAYS = 5;

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

  /**
   * Days on market, counted only from listings whose date means what we think
   * it means. Anything listed before the changeover carries an authority date
   * and is left out of this figure entirely — it still counts as a sale.
   */
  const daysFor = (rows: any[]): number | null => {
    if (!ONLINE_DATE_FROM) return null;
    const spans = rows
      .filter((r) => String(r?.date_listed ?? "") >= ONLINE_DATE_FROM)
      .map((r) => {
        const a = Date.parse(String(r?.date_listed ?? ""));
        const b = Date.parse(String(r?.sale_date ?? ""));
        if (isNaN(a) || isNaN(b)) return 0;
        const d = (b - a) / 86_400_000;
        return d >= 0 && d < 3650 ? d : 0;
      })
      .filter((d) => d > 0);
    if (spans.length < MIN_FOR_DAYS) return null;
    const m = median(spans);
    return m === null ? null : Math.round(m * 10) / 10;
  };

  const byType = [...seen.entries()]
    .map(([type, rows]) => ({
      type,
      sold: rows.length,
      medianPrice: median(priced(rows)),
      medianDays: daysFor(rows),
    }))
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
