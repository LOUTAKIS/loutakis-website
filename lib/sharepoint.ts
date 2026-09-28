import "server-only";
import { getAccessToken } from "./mail";

/**
 * Read-only access to the property folders in SharePoint, for the vendor
 * marketing approval page.
 *
 * Uses the same Azure app that sends the website's email, with Sites.Read.All
 * granted 3 Sep 2026. Nothing here writes.
 *
 * Folder convention (observed, not configured):
 *   Documents / Maree / Properties / Current / <Street> <Number> / MEDIA /
 *       BOARD/  BROCHURE/  COPY/  FLOORPLAN/  IMAGES/  VIDEO/
 *
 * The <Number> part is written by hand and separated however the day went:
 * "Lae 4@14", "High 12.286", "Saltley 3@19", "Anderson 16&#x3a;123-129" — that
 * last one is a folder created on a Mac as "16/123-129", which macOS stores as
 * a colon and SharePoint then escapes, because a slash cannot be in a name.
 * Matching therefore compares LETTERS AND DIGITS SEPARATELY and ignores every
 * separator, so a unit number survives whatever it was typed with.
 * Sold campaigns move from Current/ to Sold/. Only BOARD and BROCHURE are read
 * — photos, floorplan, copy and video come from Box & Dice, which is loaded
 * before approval and doesn't carry the drafts the SharePoint folders do.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

/** The "Documents" library on the LoutakisRealEstate site. */
const DRIVE_ID =
  process.env.SHAREPOINT_DRIVE_ID ??
  "b!fcHo0cqbuUeW5YHWzAp_h3I1q59JtfZImwmtrHHZve6twN4aYqEPTpaS_vyzm1nW";
const PROPERTIES_ROOT = process.env.SHAREPOINT_PROPERTIES_ROOT ?? "Maree/Properties";
const STAGES = ["Current", "Sold"] as const;

export type DriveFile = {
  id: string;
  name: string;
  size: number;
  mime: string;
  modified: string;
  webUrl: string;
};

export type PropertyFolder = {
  id: string;
  name: string;
  stage: (typeof STAGES)[number];
  path: string;
  webUrl: string;
};

async function graph<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Graph ${path} -> ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

type Item = {
  id: string;
  name: string;
  size?: number;
  webUrl?: string;
  lastModifiedDateTime?: string;
  folder?: unknown;
  file?: { mimeType?: string };
};

async function children(pathInDrive: string): Promise<Item[]> {
  const enc = pathInDrive.split("/").map(encodeURIComponent).join("/");
  const json = await graph<{ value: Item[] }>(`/drives/${DRIVE_ID}/root:/${enc}:/children?$top=200`);
  return json.value ?? [];
}

/** Children of a path relative to an item id — no folder name in the URL. */
async function childrenOfItem(itemId: string, sub: string): Promise<Item[]> {
  const enc = sub.split("/").map(encodeURIComponent).join("/");
  const json = await graph<{ value: Item[] }>(
    `/drives/${DRIVE_ID}/items/${encodeURIComponent(itemId)}:/${enc}:/children?$top=200`
  );
  return json.value ?? [];
}

/**
 * SharePoint hands back names with the characters it won't allow escaped as
 * HTML entities — a folder Finder shows as "Anderson 16/123-129" arrives as
 * "Anderson 16&#x3a;123-129". Left encoded, "x3a" lands in the middle of the
 * street number and no amount of normalising will match it.
 */
export function decodeName(raw: string): string {
  return String(raw ?? "").replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) =>
    String.fromCharCode(code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code))
  );
}

/** "76B Paxton" / "Paxton 76B" / "paxton76b" all become "paxton76b". */
const norm = (s: string) => decodeName(s).toLowerCase().replace(/[^a-z0-9]/g, "");
/** Just the letters: "Anderson 16/123-129" -> "anderson". */
const letters = (s: string) => decodeName(s).toLowerCase().replace(/[^a-z]/g, "");
/** Just the digits, in order: "16/123-129", "16@123-129", "16:123-129" -> "16123129". */
const digits = (s: string) => decodeName(s).replace(/[^0-9]/g, "");

/**
 * Find the folder for a listing by street name and number.
 *
 * Folders are named "<Street> <Number>" by hand. The street has to be in the
 * name and the numbers have to be the same numbers, compared as digits alone
 * so the separator doesn't matter. Only if nothing matches that way do we fall
 * back to a partial-number guess. Current is searched before Sold, and the
 * caller shows the match to a staff member before anything reaches a vendor —
 * this is a suggestion, not a guarantee.
 */
export async function findPropertyFolder(
  streetName: string,
  number: string
): Promise<{ match: PropertyFolder | null; candidates: PropertyFolder[] }> {
  const street = letters(streetName);
  const num = digits(number);
  const wanted = `${norm(streetName)}${norm(number)}`;
  const candidates: PropertyFolder[] = [];
  const loose: PropertyFolder[] = [];

  for (const stage of STAGES) {
    let items: Item[] = [];
    try {
      items = await children(`${PROPERTIES_ROOT}/${stage}`);
    } catch (err) {
      console.error(`[sharepoint] could not list ${stage}`, err);
      continue;
    }
    for (const it of items) {
      if (!it.folder) continue;
      /**
       * The street has to be there and the numbers have to be the same
       * numbers. Comparing the digits as their own string is what makes the
       * separator irrelevant — "16/123-129", "16@123-129" and the escaped
       * colon all reduce to 16123129 — while still refusing to confuse
       * Anderson 107 with Anderson 16/123-129.
       */
      const n = letters(it.name);
      const d = digits(it.name);
      if (!street || !n.includes(street)) continue;

      const found: PropertyFolder = {
        id: it.id,
        name: decodeName(it.name),
        stage,
        path: `${PROPERTIES_ROOT}/${stage}/${it.name}`,
        webUrl: it.webUrl ?? "",
      };
      if (!num || d === num) candidates.push(found);
      /**
       * Only if nothing matched cleanly: a folder whose digits are part of the
       * listing's, or the other way round, so "William 19 (2026)" and a folder
       * named for the street number alone are still OFFERED. Kept apart from
       * the real matches because this one guesses, and a staff member confirms
       * the folder before anything reaches a vendor.
       */
      else if (d && (d.includes(num) || num.includes(d))) loose.push(found);
    }
  }

  // Prefer an exact name, then Current over Sold, then a guess.
  const exact = candidates.find((c) => norm(c.name) === wanted);
  const all = candidates.length ? candidates : loose;
  return { match: exact ?? all[0] ?? null, candidates: all };
}

/**
 * Where a property's folder is.
 *
 * THE ID IS THE REAL ANSWER and the path is a fallback for campaigns stored
 * before we kept one. A path has to be re-encoded on every request, and these
 * folder names contain the exact characters — colons, slashes, ampersands —
 * that a path cannot survive. An item id contains none of them, and it also
 * survives the folder being renamed or moved from Current to Sold.
 */
export type FolderRef = { id?: string | null; path?: string | null };

/** Files directly inside MEDIA/<section> for a property folder. */
export async function listMediaSection(
  folder: FolderRef | string,
  section: "BOARD" | "BROCHURE"
): Promise<DriveFile[]> {
  const ref: FolderRef = typeof folder === "string" ? { path: folder } : folder;
  let items: Item[] = [];
  try {
    items = ref.id
      ? await childrenOfItem(ref.id, `MEDIA/${section}`)
      : ref.path
        ? await children(`${ref.path}/MEDIA/${section}`)
        : [];
  } catch (err) {
    // A missing section folder is normal (no board on some campaigns).
    if (!String(err).includes("404")) console.error(`[sharepoint] ${section} list failed`, err);
    return [];
  }
  return items
    .filter((it) => it.file && !it.name.startsWith("~$")) // skip Office lock files
    .map((it) => ({
      id: it.id,
      name: it.name,
      size: it.size ?? 0,
      mime: it.file?.mimeType ?? "application/octet-stream",
      modified: it.lastModifiedDateTime ?? "",
      webUrl: it.webUrl ?? "",
    }));
}

/**
 * Does this item still exist, and what is it called?
 *
 * A cheap metadata read used to check a campaign's files before a vendor is
 * emailed a link to them. Distinguishes "gone" from "we can't get at it",
 * because the two need different people to fix them: a 404 is a file that was
 * re-uploaded and can be found again by name, while a 401 or 403 is the Graph
 * credential and no amount of looking will help.
 */
export async function fileMeta(
  itemId: string
): Promise<{ ok: true; name: string; size: number } | { ok: false; status: number }> {
  const token = await getAccessToken();
  const res = await fetch(
    `${GRAPH}/drives/${DRIVE_ID}/items/${encodeURIComponent(itemId)}?$select=id,name,size`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!res.ok) return { ok: false, status: res.status };
  const json: any = await res.json();
  return { ok: true, name: String(json?.name ?? ""), size: Number(json?.size ?? 0) };
}

/**
 * Stream a file's bytes. Graph answers the /content request with a redirect to
 * a short-lived pre-authenticated URL; we follow it server-side and hand the
 * body on, so SharePoint itself is never exposed to the vendor's browser.
 */
export async function downloadFile(itemId: string): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH}/drives/${DRIVE_ID}/items/${encodeURIComponent(itemId)}/content`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Graph download ${itemId} -> ${res.status}`);
  return res;
}
