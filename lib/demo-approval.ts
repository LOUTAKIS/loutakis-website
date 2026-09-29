import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@vercel/global-config";
import type { Campaign } from "./campaigns";
import { timingSafeEqual, createHmac } from "node:crypto";

/**
 * The example marketing approval a prospective vendor can look at.
 *
 * The listing presentation email tells a seller they'll approve their marketing
 * on their own page, and then asks them to imagine it. This is the page itself
 * — one real campaign, shown behind a shared password, so the promise is
 * demonstrated rather than described.
 *
 * WHAT A STRANGER MUST NOT SEE. The property is already publicly advertised:
 * the address, board, brochure, copy and photographs cost that vendor nothing.
 * Their NAMES, email addresses and the record of who approved what are not
 * public and are never rendered on this route — they agreed to approve their
 * own marketing, not to appear in somebody else's sales material.
 *
 * IT KEEPS ITS OWN COPY. What is stored is the whole campaign as it stood when
 * it was nominated, not a pointer to the live one. The example is meant to be
 * the same page every time a seller is shown it, for months, while the campaign
 * behind it goes to approved, gets tidied away, or is deleted outright — and a
 * pointer would break or, worse, quietly start showing something else. Changing
 * the example is a deliberate act on the approvals page, and nothing else
 * changes it.
 *
 * The password is a gate, not security. It keeps the page off the open web and
 * out of search results; it is shared in an email and will be passed around,
 * which is fine, because everything behind it is marketing a stranger could
 * see on realestate.com.au anyway.
 */

const STORE_ID = process.env.GLOBAL_CONFIG_ID ?? "ecfg_y2dshgcsqthztqvi74jh0tqo1uzs";
const TEAM_ID = process.env.VERCEL_TEAM_ID ?? "team_P499DP8ocTP5k7vIJChVJiS1";
const API_TOKEN = process.env.VERCEL_API_TOKEN;
const client = process.env.GLOBAL_CONFIG ? createClient(process.env.GLOBAL_CONFIG) : null;

const KEY = "demo_campaign";
const COOKIE = "lre_demo";
/** A fortnight. Long enough that a vendor mulling it over doesn't re-type it. */
const DAYS = 14;

/**
 * NO FALLBACK PASSWORD. A default in the repository is a password published on
 * GitHub, and "it's only a demo" is how that argument always starts. Unset
 * means the page is off.
 */
function password(): string | null {
  const p = process.env.MARKETING_DEMO_PASSWORD?.trim();
  return p ? p : null;
}

export function demoConfigured(): boolean {
  return Boolean(password());
}

/** The nominated example: the campaign as it was, and who froze it. */
export type Demo = { campaign: Campaign; at: string; by: string };

function parse(raw: unknown): Demo | null {
  if (!raw) return null;
  /**
   * The first version of this stored a bare campaign id. Anything that isn't a
   * whole snapshot is treated as nothing rather than guessed at: re-nominating
   * on the approvals page takes one click, and a half-restored example shown to
   * a prospective seller is worse than an honest "not set".
   */
  if (typeof raw !== "object") return null;
  const d = raw as Partial<Demo>;
  if (!d.campaign || typeof (d.campaign as Campaign).id !== "string") return null;
  return { campaign: d.campaign as Campaign, at: String(d.at ?? ""), by: String(d.by ?? "") };
}

export async function getDemo(): Promise<Demo | null> {
  if (API_TOKEN) {
    try {
      const res = await fetch(
        `https://api.vercel.com/v1/global-config/${STORE_ID}/item/${KEY}?teamId=${encodeURIComponent(TEAM_ID)}`,
        { headers: { Authorization: `Bearer ${API_TOKEN}` }, cache: "no-store" }
      );
      if (res.ok) {
        // An empty 200 is a key never written; res.json() throws on it.
        const text = await res.text();
        if (!text.trim()) return null;
        return parse(JSON.parse(text)?.value);
      }
      if (res.status !== 404) console.error(`[demo] REST read -> ${res.status}`);
    } catch (err) {
      console.error("[demo] REST read failed", err);
    }
  }
  if (!client) return null;
  try {
    return parse(await client.get<unknown>(KEY));
  } catch (err) {
    console.error("[demo] SDK read failed", err);
    return null;
  }
}

/** The frozen campaign itself — what /marketingapproval renders. */
export async function getDemoCampaign(): Promise<Campaign | null> {
  return (await getDemo())?.campaign ?? null;
}

/** Its id, which is all the file route needs to decide whether to serve. */
export async function getDemoCampaignId(): Promise<string | null> {
  return (await getDemo())?.campaign.id ?? null;
}

export async function setDemoCampaign(campaign: Campaign | null, by: string): Promise<void> {
  if (!API_TOKEN) throw new Error("VERCEL_API_TOKEN not set — cannot save the demo campaign");
  const value: Demo | null = campaign
    ? { campaign, at: new Date().toISOString(), by }
    : null;
  const res = await fetch(
    `https://api.vercel.com/v1/global-config/${STORE_ID}/items?teamId=${encodeURIComponent(TEAM_ID)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [value ? { operation: "upsert", key: KEY, value } : { operation: "delete", key: KEY }],
      }),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`demo campaign write -> ${res.status} ${await res.text()}`);
}

/**
 * Keep the frozen copy's file ids current when SharePoint has moved them.
 *
 * The artwork can be re-exported and re-uploaded, which kills the item id we
 * kept. The resolver finds it again by name and heals the live campaign; the
 * example needs the same repair or it pays for the lookup on every view — and
 * would break for good once the live campaign is gone.
 */
export async function healDemoFile(
  campaignId: string,
  kind: "board" | "brochure",
  id: string,
  name: string
): Promise<void> {
  const demo = await getDemo();
  if (!demo || demo.campaign.id !== campaignId) return;
  const selection = {
    ...demo.campaign.selection,
    ...(kind === "board" ? { boardId: id, boardName: name } : { brochureId: id, brochureName: name }),
  };
  await setDemoCampaign({ ...demo.campaign, selection }, demo.by);
}

/**
 * The cookie is a signature over the password, not the password itself — so a
 * stolen cookie stops working the moment the password is changed, and the
 * password never sits in a browser jar in readable form.
 */
function stamp(): string {
  const secret = process.env.PORTAL_TOKEN_SECRET ?? "";
  return createHmac("sha256", secret).update(`demo:${password() ?? ""}`).digest("base64url");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  // Constant-time: a fast rejection leaks how much of it was right.
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(attempt: string): boolean {
  const p = password();
  if (!p) return false;
  return same(String(attempt ?? "").trim(), p);
}

export function isUnlocked(): boolean {
  if (!password()) return false;
  const got = cookies().get(COOKIE)?.value ?? "";
  return Boolean(got) && same(got, stamp());
}

export function unlock() {
  cookies().set(COOKIE, stamp(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: DAYS * 86400,
  });
}
