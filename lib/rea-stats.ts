import "server-only";
import { createClient } from "@vercel/global-config";

/**
 * Our market performance, as published on realestate.com.au.
 *
 * WHY THIS IS THE SOURCE, AND NOT OUR OWN CRM.
 *
 * The figures must always agree with REA, because that is where a vendor will
 * check them. Computing our own cannot guarantee that. Reconciled on 9 Sep
 * 2026 our CRM gave 26 houses at a $985,000 median and 3 apartments at
 * $400,000 — identical to REA — but 10 townhouses to their 11, which dragged
 * the overall median to $935,000 against their $908k. One sale, sitting a few
 * days either side of a window boundary, and two published numbers disagree.
 *
 * So REA's card is what gets published, attributed to them. Our own figures are
 * still computed (lib/sales-stats) and shown beside these on the staff screen,
 * where a growing gap is a signal that something in the CRM needs attention —
 * a sale with no sale date, or a property typed as the wrong category.
 *
 * Days advertised could never have been ours anyway: the CRM records when the
 * authority was signed, not when advertising began.
 *
 * ENTERED BY HAND, WHICH IS WHY `checkedOn` MATTERS. A figure whose age nobody
 * can see is a figure that goes stale silently. The page prints the date it was
 * read; the staff screen asks for it again after three months.
 */

const STORE_ID = process.env.GLOBAL_CONFIG_ID ?? "ecfg_y2dshgcsqthztqvi74jh0tqo1uzs";
const TEAM_ID = process.env.VERCEL_TEAM_ID ?? "team_P499DP8ocTP5k7vIJChVJiS1";
const API_TOKEN = process.env.VERCEL_API_TOKEN;
const client = process.env.GLOBAL_CONFIG ? createClient(process.env.GLOBAL_CONFIG) : null;

const KEY = "rea_stats";

export type ReaTypeRow = {
  type: string;
  sold: number;
  medianPrice: number;
  medianDays: number;
};

export type ReaSnapshot = {
  totalSold: number;
  medianPrice: number;
  rows: ReaTypeRow[];
  /** ISO date the figures were read off REA. */
  checkedOn: string;
  checkedBy?: string;
  /** Off until someone has read the numbers and is happy to publish them. */
  published: boolean;
};

export const REA_PROFILE = "https://www.realestate.com.au/agency/loutakis-real-estate-YGFUOB";

/** Older than this and the staff screen starts asking for a fresh reading. */
export const STALE_AFTER_DAYS = 90;

export async function getReaStats(): Promise<ReaSnapshot | null> {
  if (API_TOKEN) {
    try {
      const res = await fetch(
        `https://api.vercel.com/v1/global-config/${STORE_ID}/item/${KEY}?teamId=${encodeURIComponent(TEAM_ID)}`,
        { headers: { Authorization: `Bearer ${API_TOKEN}` }, cache: "no-store" }
      );
      if (res.ok) {
        const json: any = await res.json();
        return (json?.value ?? null) as ReaSnapshot | null;
      }
      if (res.status !== 404) console.error(`[rea-stats] read -> ${res.status}`);
    } catch (err) {
      console.error("[rea-stats] read failed", err);
    }
  }
  if (!client) return null;
  return (await client.get<ReaSnapshot>(KEY).catch(() => undefined)) ?? null;
}

export async function saveReaStats(value: ReaSnapshot): Promise<void> {
  if (!API_TOKEN) throw new Error("VERCEL_API_TOKEN not set — cannot save");
  const res = await fetch(
    `https://api.vercel.com/v1/global-config/${STORE_ID}/items?teamId=${encodeURIComponent(TEAM_ID)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ operation: "upsert", key: KEY, value }] }),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`rea stats write -> ${res.status} ${await res.text()}`);
}

export function daysSinceChecked(v: ReaSnapshot | null): number | null {
  if (!v?.checkedOn) return null;
  const t = Date.parse(v.checkedOn);
  return isNaN(t) ? null : Math.floor((Date.now() - t) / 86_400_000);
}
