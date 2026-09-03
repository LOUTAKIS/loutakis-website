import "server-only";
import { randomBytes } from "node:crypto";
import { createClient } from "@vercel/global-config";

/**
 * Vendor marketing approval campaigns.
 *
 * One campaign = one listing sent to one vendor for approval. Held in the
 * same Global Config store as the portal, under `vc_<id>`, with an index of
 * ids in `vc_index`. Six-odd a month and a handful of writes each — well
 * inside what that store is for. The authoritative record of an approval is
 * the note written to the listing in Box & Dice; this is the working state.
 */

const STORE_ID = process.env.GLOBAL_CONFIG_ID ?? "ecfg_y2dshgcsqthztqvi74jh0tqo1uzs";
const TEAM_ID = process.env.VERCEL_TEAM_ID ?? "team_P499DP8ocTP5k7vIJChVJiS1";
const API_TOKEN = process.env.VERCEL_API_TOKEN;
const client = process.env.GLOBAL_CONFIG ? createClient(process.env.GLOBAL_CONFIG) : null;

export type CampaignStatus = "draft" | "sent" | "opened" | "approved" | "changes";

export type Blurbs = {
  board: string;
  brochure: string;
  copy: string;
  floorplan: string;
  images: string;
  video: string;
};

export type Selection = {
  /** Photo URLs the staff member UNTICKED. Everything else from the CRM shows. */
  excludedPhotos: string[];
  includeFloorplan: boolean;
  includeCopy: boolean;
  includeVideo: boolean;
  /** SharePoint item ids, or null for "don't show this section". */
  boardId: string | null;
  boardName: string | null;
  brochureId: string | null;
  brochureName: string | null;
  blurbs: Blurbs;
};

export type Amendment = { at: string; text: string; name: string };

export type Campaign = {
  id: string;
  listingId: number;
  address: string; // "76B Paxton Street, South Kingsville"
  street: string; // for the SharePoint folder match
  number: string;
  folderPath: string | null; // confirmed SharePoint property folder
  vendorName: string;
  vendorEmail: string;
  createdBy: string; // staff email
  createdAt: string;
  sentAt: string | null;
  sentBy: string | null;
  openedAt: string | null;
  openCount: number;
  status: CampaignStatus;
  approvedAt: string | null;
  approvedName: string | null;
  amendments: Amendment[];
  selection: Selection;
  /** Snapshot of the copy at send time, so what was approved is what was shown. */
  copyText: string;
  copyHeading: string;
};

export const DEFAULT_BLURBS: Blurbs = {
  board:
    "Your first impression on the street. Clean, sharp, and designed to catch the eye. The board sets the tone and gets buyers stopping, looking, and remembering.",
  brochure:
    "Something they can take with them. A clear, stylish snapshot of your home that puts the story in their hands and keeps your property front of mind.",
  copy:
    "Words that work. Crafted to be straight, engaging, and memorable. The copy makes sure your property isn’t just listed, it’s noticed.",
  floorplan:
    "Clarity buyers need. A simple, accurate layout that helps people imagine how they’ll live in the space before they even step inside.",
  images: "",
  video: "",
};

const key = (id: string) => `vc_${id}`;
const INDEX = "vc_index";

export function newCampaignId(): string {
  return randomBytes(6).toString("base64url");
}

async function write(items: Array<{ operation: "upsert" | "delete"; key: string; value?: unknown }>) {
  if (!API_TOKEN) throw new Error("VERCEL_API_TOKEN not set — cannot save campaign");
  const res = await fetch(
    `https://api.vercel.com/v1/global-config/${STORE_ID}/items?teamId=${encodeURIComponent(TEAM_ID)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`campaign store write -> ${res.status} ${await res.text()}`);
}

async function readIndex(): Promise<string[]> {
  if (!client) return [];
  const v = await client.get<string[]>(INDEX).catch(() => undefined);
  return Array.isArray(v) ? v : [];
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  if (!client) return null;
  const v = await client.get<Campaign>(key(id)).catch(() => undefined);
  return v ?? null;
}

export async function listCampaigns(): Promise<Campaign[]> {
  const ids = await readIndex();
  const all = await Promise.all(ids.map(getCampaign));
  return all
    .filter((c): c is Campaign => Boolean(c))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export async function saveCampaign(c: Campaign): Promise<void> {
  const ids = await readIndex();
  const items: Array<{ operation: "upsert"; key: string; value: unknown }> = [
    { operation: "upsert", key: key(c.id), value: c },
  ];
  if (!ids.includes(c.id)) {
    // Keep the most recent 100 in the index; older campaigns stay readable by id.
    items.push({ operation: "upsert", key: INDEX, value: [...ids, c.id].slice(-100) });
  }
  await write(items);
}

/**
 * Partial update, read-modify-write. Two staff editing the same campaign at
 * the same second could clobber each other; at six campaigns a month that is
 * not a real risk, and the approval note in the CRM is the record regardless.
 */
export async function updateCampaign(id: string, patch: Partial<Campaign>): Promise<Campaign> {
  const current = await getCampaign(id);
  if (!current) throw new Error(`campaign ${id} not found`);
  const next = { ...current, ...patch };
  await write([{ operation: "upsert", key: key(id), value: next }]);
  return next;
}
