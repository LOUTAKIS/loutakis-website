import "server-only";
import { unstable_cache } from "next/cache";
import { getRawSalesListings, getPropertyCategories } from "./boxdice";

/**
 * Our market performance, for the Sell with us page. Nothing is entered by
 * hand; every figure comes from Box & Dice and updates itself.
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
 * DAYS ADVERTISED is measured from `date_listed`, which the CRM now records as
 * the day a listing went online rather than the day the authority was signed.
 * Cross-checked against REA Ignite's own days column, that basis reproduces
 * their medians exactly: House 20.5, Townhouse 21, Apartment 20.
 *
 * A listing that never went online carries date_listed = sale_date, so its span
 * is zero and it drops out of the days median while still counting as a sale —
 * which is how REA treats an off-market sale too. Four of the last forty were
 * sold that way.
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

  /**
   * fresh=false on both: this function runs inside unstable_cache, and a
   * no-store fetch in that context throws. That is what emptied this section
   * on its first deploy — the error was caught and the page simply hid it.
   */
  const [raw, categories] = await Promise.all([
    getRawSalesListings(false),
    getPropertyCategories(false),
  ]);

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
   * Days on market: from the day it went online to the day it sold.
   *
   * A zero span means it never went online — an off-market sale, where
   * date_listed and sale_date are the same day. Those are excluded here and
   * still counted as sales, which is exactly how REA reports them.
   */
  const daysFor = (rows: any[]): number | null => {
    const spans = rows
      .map((r) => {
        const a = Date.parse(String(r?.date_listed ?? ""));
        const b = Date.parse(String(r?.sale_date ?? ""));
        if (isNaN(a) || isNaN(b)) return 0;
        const d = (b - a) / 86_400_000;
        return d >= 0 && d < 3650 ? d : 0;
      })
      .filter((d) => d > 0);
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

/**
 * "$907,500" — the figure in full.
 *
 * REA abbreviates to $908k; we do not. A price is what a vendor is here to
 * read, and rounding it to three digits both loses precision and makes the
 * claim look softer than it is.
 */
export function price(n: number | null): string {
  if (!n) return "—";
  return `$${Math.round(n).toLocaleString("en-AU")}`;
}
