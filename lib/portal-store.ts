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

/* ── New-listing alerts ────────────────────────────────────────────────────
   Three small lists, all keyed by contact id — no names or addresses.
   `approved` is who to consider emailing, `seen` is which off-market listings
   have already been announced, `optout` is who asked to stop. Access itself is
   still governed by the CRM category; this is only about email. */

const KEY_APPROVED = "alerts_approved";
const KEY_SEEN = "alerts_seen_listings";
const KEY_OPTOUT = "alerts_optout";

async function readList(key: string): Promise<number[]> {
  if (!client) return [];
  try {
    const v = await client.get<number[]>(key);
    return Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : [];
  } catch (err) {
    console.error(`[portal-store] ${key} read failed`, err);
    return [];
  }
}

/* ── Member activity ───────────────────────────────────────────────────────
   One key per contact holding their recent account activity, newest first.
   See lib/portal-activity for what is recorded and why this store is an
   acceptable home for it. The value is timestamps, event kinds and listing
   ids — no names, no addresses of people, nothing about anyone who has not
   signed in. */

const activityKey = (contactId: number | string) => `act_${Number(contactId)}`;

export async function readActivity(contactId: number | string): Promise<any[]> {
  if (!client) return [];
  try {
    const v = await client.get<any[]>(activityKey(contactId));
    return Array.isArray(v) ? v : [];
  } catch (err) {
    console.error("[portal-store] activity read failed", err);
    return [];
  }
}

export async function writeActivity(contactId: number | string, events: any[]): Promise<void> {
  await upsert([{ operation: "upsert", key: activityKey(contactId), value: events }]);
}

export const listApprovedContacts = () => readList(KEY_APPROVED);
export const listOptedOut = () => readList(KEY_OPTOUT);

/**
 * Every contact id we have ever stored — the people who registered through
 * this website, whatever became of them.
 *
 * There is no way to ask Box & Dice "who is in this category": the contacts
 * collection takes no category filter, and crawling every contact in the CRM
 * to find eleven of them would be both slow and rate-limited. But we wrote a
 * key for each registration ourselves, so the ids are already here.
 *
 * Keys are `e_<hash>` and `m_<hash>` — an email and a mobile for the same
 * person point at the same id, hence the Set. Still no addresses or phone
 * numbers in the store: the values are ids, and the keys are one-way hashes.
 *
 * The approved list is folded in so nobody who has access can be missing from
 * the roll, even if their lookup key was written before this existed.
 */
export async function listRegisteredContacts(): Promise<number[]> {
  if (!client) return [];
  const ids = new Set<number>();
  try {
    const all = await client.getAll<Record<string, unknown>>();
    for (const [key, value] of Object.entries(all ?? {})) {
      if (!key.startsWith("e_") && !key.startsWith("m_")) continue;
      const id = Number(value);
      if (Number.isFinite(id) && id > 0) ids.add(id);
    }
  } catch (err) {
    console.error("[portal-store] listRegisteredContacts failed", err);
  }
  for (const id of await listApprovedContacts()) ids.add(id);
  return [...ids];
}

export async function addApprovedContact(contactId: number | string): Promise<void> {
  const id = Number(contactId);
  const current = await listApprovedContacts();
  if (current.includes(id)) return;
  await upsert([{ operation: "upsert", key: KEY_APPROVED, value: [...current, id] }]);
}

export async function removeApprovedContact(contactId: number | string): Promise<void> {
  const id = Number(contactId);
  const current = await listApprovedContacts();
  if (!current.includes(id)) return;
  await upsert([{ operation: "upsert", key: KEY_APPROVED, value: current.filter((x) => x !== id) }]);
}

/** Opting out stops the emails. It does NOT remove portal access. */
export async function optOutOfAlerts(contactId: number | string): Promise<void> {
  const id = Number(contactId);
  const current = await listOptedOut();
  if (current.includes(id)) return;
  await upsert([{ operation: "upsert", key: KEY_OPTOUT, value: [...current, id] }]);
}

/** Listing ids already announced, so nobody is emailed about the same home twice. */
export async function getAnnouncedListings(): Promise<number[]> {
  return readList(KEY_SEEN);
}

export async function setAnnouncedListings(ids: Array<number | string>): Promise<void> {
  // Keep the most recent 200 — enough that a listing untagged and retagged
  // months later counts as new, without the key growing forever.
  const trimmed = ids.map(Number).filter(Number.isFinite).slice(-200);
  await upsert([{ operation: "upsert", key: KEY_SEEN, value: trimmed }]);
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

/**
 * "We already told this address it isn't registered" — so the sign-in form
 * can't be used to post the same person an unlimited number of emails.
 * Returns true the first time for an address, false while the note is fresh.
 */
export async function shouldSendNotRegistered(email: string, hours = 24): Promise<boolean> {
  const key = `nr_${hash(normaliseEmail(email))}`;
  if (client) {
    try {
      const last = await client.get<number>(key);
      if (typeof last === "number" && Date.now() - last < hours * 3_600_000) return false;
    } catch {
      /* read failed — better to send than to swallow a genuine request */
    }
  }
  await upsert([{ operation: "upsert", key, value: Date.now() }]).catch(() => {});
  return true;
}

/**
 * Sign-in codes: the six digits printed in the email beside the button, so a
 * buyer reading their phone can finish signing in on the computer in front of
 * them. Held in the store, not in a token, because a code must be usable once
 * and then gone — and must stop working after a few wrong guesses.
 *
 * `device` is a random id set on the browser that asked for the code; the code
 * only works there, so a forwarded email is useless on someone else's machine.
 */
export type SignInCode = {
  contactId: number;
  code: string;
  device: string;
  expires: number;
  tries: number;
};

const codeKey = (device: string) => `sic_${hash(device)}`;

export async function saveSignInCode(c: SignInCode): Promise<void> {
  await upsert([{ operation: "upsert", key: codeKey(c.device), value: c as any }]);
}

export async function readSignInCode(device: string): Promise<SignInCode | null> {
  if (!client) return null;
  try {
    return (await client.get<SignInCode>(codeKey(device))) ?? null;
  } catch {
    return null;
  }
}

export async function clearSignInCode(device: string): Promise<void> {
  await upsert([{ operation: "delete", key: codeKey(device) }]).catch(() => {});
}

/** Note a wrong guess; the caller throws the code away once tries run out. */
export async function bumpSignInTries(c: SignInCode): Promise<void> {
  await upsert([{ operation: "upsert", key: codeKey(c.device), value: { ...c, tries: c.tries + 1 } as any }]).catch(
    () => {}
  );
}

/**
 * The address a person actually registered with. The CRM's primary email may
 * be something else entirely (an existing contact matched on name and mobile),
 * and portal mail must go where they expect it, not to the office's copy.
 */
const registeredKey = (contactId: number | string) => `re_${Number(contactId)}`;

export async function rememberRegisteredEmail(contactId: number | string, email: string): Promise<void> {
  const clean = normaliseEmail(email);
  if (!clean) return;
  await upsert([{ operation: "upsert", key: registeredKey(contactId), value: clean }]).catch((err) =>
    console.error("[portal-store] registered email write failed", err)
  );
}

export async function getRegisteredEmail(contactId: number | string): Promise<string | null> {
  if (!client) return null;
  try {
    return (await client.get<string>(registeredKey(contactId))) ?? null;
  } catch {
    return null;
  }
}
