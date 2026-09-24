import "server-only";
import { randomBytes } from "node:crypto";
import { createClient } from "@vercel/global-config";
import type { Vendor } from "./vendors";
import type { Answers, Section } from "./questionnaire-form";

export { campaignVendors as questionnaireVendors, vendorEmails, vendorGreeting, type Vendor } from "./vendors";

/**
 * Vendor questionnaires — the record, and where it is kept.
 *
 * One questionnaire = one property, sent to the people on the title once the
 * authority is signed. Held in the same Global Config store as campaigns and
 * the portal, under `pq_<id>` with an index of ids in `pq_index`.
 *
 * SEPARATE FROM A CAMPAIGN ON PURPOSE. A campaign is the marketing approval,
 * assembled when the brochure and board exist. The questionnaire comes weeks
 * earlier — the answers are half of what the copywriter needs before there is
 * anything to approve — so tying one to the other would mean creating an empty
 * campaign just to ask a vendor about their heating.
 *
 * The delivery of the answers (PDF, email, CRM note) lives in
 * questionnaire-deliver.ts, the way vendor.ts sits beside campaigns.ts.
 */

const STORE_ID = process.env.GLOBAL_CONFIG_ID ?? "ecfg_y2dshgcsqthztqvi74jh0tqo1uzs";
const TEAM_ID = process.env.VERCEL_TEAM_ID ?? "team_P499DP8ocTP5k7vIJChVJiS1";
const API_TOKEN = process.env.VERCEL_API_TOKEN;
const client = process.env.GLOBAL_CONFIG ? createClient(process.env.GLOBAL_CONFIG) : null;

export type QuestionnaireStatus = "sent" | "opened" | "started" | "complete";

export type Questionnaire = {
  id: string;
  listingId: number;
  address: string;
  /** Everyone on the title. The link is shared; whoever submits is recorded. */
  vendors: Vendor[];
  /** The agent on the listing — where the answers are sent. */
  agentName: string;
  agentEmail: string;
  createdBy: string;
  createdAt: string;
  sentAt: string | null;
  sentBy: string | null;
  openedAt: string | null;
  openCount: number;
  status: QuestionnaireStatus;
  /** Answers as last saved, complete or not. */
  answers: Answers;
  /** Last deliberate "save and finish later". Null until they use it. */
  savedAt: string | null;
  submittedAt: string | null;
  submittedName: string | null;
  /**
   * The questions as they stood when this was answered.
   *
   * Answers are stored against question ids, so without this a questionnaire
   * completed in March would be re-rendered in June using June's questions —
   * a reworded question would put words in the vendor's mouth, and a retired
   * one would erase the fact that it was ever asked. Frozen at submit, not at
   * send, so a typo fixed this morning still reaches a link sent last week.
   *
   * Absent on records written before this existed; those fall back to the
   * live set, which is the best that can be said about them.
   */
  asked?: Section[];
};

const key = (id: string) => `pq_${id}`;
const INDEX = "pq_index";

export function newQuestionnaireId(): string {
  return randomBytes(6).toString("base64url");
}

async function write(items: Array<{ operation: "upsert" | "delete"; key: string; value?: unknown }>) {
  if (!API_TOKEN) throw new Error("VERCEL_API_TOKEN not set — cannot save questionnaire");
  const res = await fetch(
    `https://api.vercel.com/v1/global-config/${STORE_ID}/items?teamId=${encodeURIComponent(TEAM_ID)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`questionnaire store write -> ${res.status} ${await res.text()}`);
}

/**
 * REST for reads, not the SDK — the SDK is edge-cached and lags a write by up
 * to ten seconds, which is exactly long enough for a vendor to press Save and
 * then reload to an empty form. Same reasoning as campaigns.ts.
 */
/**
 * A READ MUST NEVER THROW. A key that has never been written is the normal
 * state of this store on the day a feature ships, and it was what took the
 * questionnaires page down the first time: the REST endpoint answers a missing
 * item with an empty body, `res.json()` threw on it, and the exception came
 * all the way up through the page. Campaigns has the same shape and never hit
 * it only because `vc_index` was written long ago.
 *
 * So everything here is guarded and the answer to "no such item" is null.
 * `lastReadError` keeps the reason for the diagnostic route, because "null"
 * on its own cannot tell an empty store from a bad token.
 */
export let lastReadError: string | null = null;

async function readItem<T>(itemKey: string): Promise<T | null> {
  lastReadError = null;
  if (API_TOKEN) {
    try {
      const res = await fetch(
        `https://api.vercel.com/v1/global-config/${STORE_ID}/item/${encodeURIComponent(itemKey)}?teamId=${encodeURIComponent(TEAM_ID)}`,
        { headers: { Authorization: `Bearer ${API_TOKEN}` }, cache: "no-store" }
      );
      if (res.ok) {
        const text = await res.text();
        // An empty 200 is how a missing item comes back. Not an error.
        if (!text.trim()) return null;
        const json: any = JSON.parse(text);
        return (json?.value ?? null) as T | null;
      }
      if (res.status !== 404) {
        lastReadError = `REST ${res.status}`;
        console.error(`[questionnaire] REST read ${itemKey} -> ${res.status}; falling back to SDK`);
      }
    } catch (err) {
      lastReadError = `REST ${(err as Error)?.message ?? err}`;
      console.error(`[questionnaire] REST read ${itemKey} failed`, err);
    }
  }
  if (!client) return null;
  try {
    const v = await client.get<T>(itemKey);
    return v ?? null;
  } catch (err) {
    lastReadError = `SDK ${(err as Error)?.message ?? err}`;
    console.error(`[questionnaire] SDK read ${itemKey} failed`, err);
    return null;
  }
}

async function readIndex(): Promise<string[]> {
  const v = await readItem<string[]>(INDEX);
  return Array.isArray(v) ? v : [];
}

export async function getQuestionnaire(id: string): Promise<Questionnaire | null> {
  return readItem<Questionnaire>(key(id));
}

export async function listQuestionnaires(): Promise<Questionnaire[]> {
  const ids = await readIndex();
  const all = await Promise.all(ids.map(getQuestionnaire));
  return all
    .filter((q): q is Questionnaire => Boolean(q))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export async function saveQuestionnaire(q: Questionnaire): Promise<void> {
  const ids = await readIndex();
  const items: Array<{ operation: "upsert"; key: string; value: unknown }> = [
    { operation: "upsert", key: key(q.id), value: q },
  ];
  if (!ids.includes(q.id)) {
    items.push({ operation: "upsert", key: INDEX, value: [...ids, q.id].slice(-200) });
  }
  await write(items);
}

/** Partial update, read-modify-write. One vendor per property; no real contention. */
export async function updateQuestionnaire(
  id: string,
  patch: Partial<Questionnaire>
): Promise<Questionnaire> {
  const current = await getQuestionnaire(id);
  if (!current) throw new Error(`questionnaire ${id} not found`);
  const next = { ...current, ...patch };
  await write([{ operation: "upsert", key: key(id), value: next }]);
  return next;
}

export async function deleteQuestionnaire(id: string): Promise<void> {
  const ids = await readIndex();
  await write([
    { operation: "delete", key: key(id) },
    { operation: "upsert", key: INDEX, value: ids.filter((x) => x !== id) },
  ]);
}

/** The live questionnaire for a listing, if one has been sent. */
export async function questionnaireForListing(listingId: number): Promise<Questionnaire | null> {
  const all = await listQuestionnaires();
  return all.find((q) => q.listingId === listingId) ?? null;
}
