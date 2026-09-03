import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@vercel/global-config";

/**
 * The portal's only store: a lookup from a buyer's email or mobile to their
 * Box & Dice contact id, because the Website API can't search contacts.
 *
 * It holds NOTHING readable. Keys are SHA-256 hashes of the normalised email
 * or mobile — so the store contains no addresses, no phone numbers, no names.
 * Just `e_<hash>` → contact id. Everything about the person stays in the CRM.
 *
 * Reads: Vercel Global Config SDK via the GLOBAL_CONFIG connection string.
 * Writes: Vercel REST API with VERCEL_API_TOKEN (writes aren't in the SDK).
 * Writes take up to ~10s to propagate — fine for "registered → later signs in",
 * unsuitable for anything high-frequency.
 */

const STORE_ID = process.env.GLOBAL_CONFIG_ID ?? "ecfg_y2dshgcsqthztqvi74jh0tqo1uzs";
const TEAM_ID = process.env.VERCEL_TEAM_ID ?? "team_P499DP8ocTP5k7vIJChVJiS1";
const API_TOKEN = process.env.VERCEL_API_TOKEN;

const client = process.env.GLOBAL_CONFIG ? createClient(process.env.GLOBAL_CONFIG) : null;

export function storeConfigured(): { read: boolean; write: boolean } {
  return { read: Boolean(client), write: Boolean(API_TOKEN) };
}

type Write =
  | { operation: "upsert"; key: string; value: unknown }
  | { operation: "delete"; key: string };

/**
 * One PATCH to the Global Config items endpoint.
 *
 * `/v1/global-config/` — the pre-rename `/v1/edge-config/` path still answers,
 * but with a misleading 404 "Edge Config Item not found" (2 Sep 2026).
 */
async function upsert(items: Write[]): Promise<void> {
  if (!API_TOKEN) {
    console.error("[portal-store] VERCEL_API_TOKEN not set — cannot write");
    return;
  }
  if (!items.length) return;

  const res = await fetch(
    `https://api.vercel.com/v1/global-config/${STORE_ID}/items?teamId=${encodeURIComponent(TEAM_ID)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    // Loud, but not fatal: the buyer is still registered in the CRM. What they
    // lose is self-service sign-in, which the office can repair by hand.
    console.error(`[portal-store] write failed: ${res.status} ${await res.text()}`);
  }
}

/** lower-case, trimmed. */
export function normaliseEmail(email: string): string {
  return String(email ?? "").trim().toLowerCase();
}

/** Digits only, +61 → 0, so "0403 094 217", "+61403094217" and "0403094217" agree. */
export function normaliseMobile(mobile: string): string {
  return String(mobile ?? "").replace(/[^\d+]/g, "").replace(/^\+61/, "0");
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 40);

export const emailKey = (email: string) => `e_${hash(normaliseEmail(email))}`;
export const mobileKey = (mobile: string) => `m_${hash(normaliseMobile(mobile))}`;

/**
 * Pending buying criteria, held between registration and approval.
 *
 * Criteria are only written into Box & Dice once you approve someone, so the
 * answers have to live somewhere in the meantime — the approval email carries
 * only a signed contact id. Keyed by contact id, cleared the moment it's used.
 * Nothing here identifies anyone: it's budget, beds, suburb ids, timeframe.
 */
export type PendingCriteria = {
  suburbIds?: number[];
  budget?: string;
  beds?: string;
  timeframe?: string;
  situation?: string;
};

const criteriaKey = (contactId: number | string) => `c_${Number(contactId)}`;

export async function rememberCriteria(
  contactId: number | string,
  criteria: PendingCriteria
): Promise<void> {
  const hasAnything =
    criteria.suburbIds?.length || criteria.budget || criteria.beds || criteria.timeframe;
  if (!hasAnything) return;
  await upsert([{ operation: "upsert", key: criteriaKey(contactId), value: criteria as any }]);
}

/** Read the stored criteria and forget them. Safe to call when there are none. */
export async function takeCriteria(contactId: number | string): Promise<PendingCriteria | null> {
  if (!client) return null;
  let stored: PendingCriteria | undefined;
  try {
    stored = await client.get<PendingCriteria>(criteriaKey(contactId));
  } catch (err) {
    console.error("[portal-store] criteria read failed", err);
    return null;
  }
  if (!stored) return null;

  // Best effort: if the delete fails the only cost is a stale key.
  await upsert([{ operation: "delete", key: criteriaKey(contactId) }]).catch(() => {});
  return stored;
}

/** Look up a contact id by whatever the buyer typed — email or mobile. */
export async function lookupContactId(identifier: string): Promise<number | null> {
  if (!client) return null;

  const raw = String(identifier ?? "").trim();
  const key = raw.includes("@") ? emailKey(raw) : mobileKey(raw);

  const value = await client.get<number | string>(key);
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Record a buyer's email and mobile against their contact id.
 * Idempotent — upserting the same keys again is harmless.
 */
export async function rememberContact(opts: {
  contactId: number | string;
  email?: string;
  mobile?: string;
}): Promise<void> {
  const id = Number(opts.contactId);
  const items: Write[] = [];
  if (opts.email && normaliseEmail(opts.email)) {
    items.push({ operation: "upsert", key: emailKey(opts.email), value: id });
  }
  if (opts.mobile && normaliseMobile(opts.mobile)) {
    items.push({ operation: "upsert", key: mobileKey(opts.mobile), value: id });
  }
  await upsert(items);
}
