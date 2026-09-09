import "server-only";
import { createClient } from "@vercel/global-config";

/**
 * Median days advertised, read off realestate.com.au.
 *
 * THE ONLY FIGURE ON THE PAGE THAT ISN'T OURS, because it is the only one the
 * CRM cannot produce. Box & Dice records when the authority was signed, not
 * when advertising began, and `campaign_start_date` is empty on every sale.
 * Measured from the authority our median is 50 days against REA's 20.5 — the
 * same words describing a different thing. Publishing ours as "days advertised"
 * would be a false performance claim.
 *
 * Everything else on that section — sold counts, median prices, the split by
 * property type — is computed from our own records in lib/sales-stats and
 * updates itself. Those reproduce REA's card exactly, so this file is three
 * numbers, not twelve.
 *
 * ENTERED BY HAND, WHICH IS WHY `checkedOn` MATTERS. A figure whose age nobody
 * can see is one that goes stale silently. The page prints the date it was
 * read; the staff screen asks again after three months.
 *
 * Temporary by design. Once we record advertising-start dates of our own for a
 * full year, this file's job ends.
 */

const STORE_ID = process.env.GLOBAL_CONFIG_ID ?? "ecfg_y2dshgcsqthztqvi74jh0tqo1uzs";
const TEAM_ID = process.env.VERCEL_TEAM_ID ?? "team_P499DP8ocTP5k7vIJChVJiS1";
const API_TOKEN = process.env.VERCEL_API_TOKEN;
const client = process.env.GLOBAL_CONFIG ? createClient(process.env.GLOBAL_CONFIG) : null;

const KEY = "rea_days";

export type ReaDays = {
  /** Median days advertised, keyed by the property type REA uses. */
  days: Record<string, number>;
  /** ISO date the figures were read off REA. */
  checkedOn: string;
  checkedBy?: string;
  /** Off until someone has read them and is happy to publish. */
  published: boolean;
};

export const REA_PROFILE = "https://www.realestate.com.au/agency/loutakis-real-estate-YGFUOB";

/** Older than this and the staff screen starts asking for a fresh reading. */
export const STALE_AFTER_DAYS = 90;

export async function getReaDays(): Promise<ReaDays | null> {
  if (API_TOKEN) {
    try {
      const res = await fetch(
        `https://api.vercel.com/v1/global-config/${STORE_ID}/item/${KEY}?teamId=${encodeURIComponent(TEAM_ID)}`,
        { headers: { Authorization: `Bearer ${API_TOKEN}` }, cache: "no-store" }
      );
      if (res.ok) {
        const json: any = await res.json();
        return (json?.value ?? null) as ReaDays | null;
      }
      if (res.status !== 404) console.error(`[rea-days] read -> ${res.status}`);
    } catch (err) {
      console.error("[rea-days] read failed", err);
    }
  }
  if (!client) return null;
  return (await client.get<ReaDays>(KEY).catch(() => undefined)) ?? null;
}

export async function saveReaDays(value: ReaDays): Promise<void> {
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
  if (!res.ok) throw new Error(`rea days write -> ${res.status} ${await res.text()}`);
}

export function daysSinceChecked(v: ReaDays | null): number | null {
  if (!v?.checkedOn) return null;
  const t = Date.parse(v.checkedOn);
  return isNaN(t) ? null : Math.floor((Date.now() - t) / 86_400_000);
}
