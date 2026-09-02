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
  if (!API_TOKEN) {
    console.error("[portal-store] VERCEL_API_TOKEN not set — cannot write lookup entry");
    return;
  }

  const id = Number(opts.contactId);
  const items: Array<{ operation: "upsert"; key: string; value: number }> = [];
  if (opts.email && normaliseEmail(opts.email)) {
    items.push({ operation: "upsert", key: emailKey(opts.email), value: id });
  }
  if (opts.mobile && normaliseMobile(opts.mobile)) {
    items.push({ operation: "upsert", key: mobileKey(opts.mobile), value: id });
  }
  if (!items.length) return;

  // `/v1/global-config/` — the pre-rename `/v1/edge-config/` path still
  // answers, but with a misleading 404 "Edge Config Item not found" (2 Sep 2026).
  const res = await fetch(
    `https://api.vercel.com/v1/global-config/${STORE_ID}/items?teamId=${encodeURIComponent(TEAM_ID)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
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
