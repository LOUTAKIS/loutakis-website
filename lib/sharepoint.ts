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

/** "76B Paxton" / "Paxton 76B" / "paxton76b" all become "paxton76b". */
const norm = (s: string) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Find the folder for a listing by street name and number.
 *
 * Folders are named "<Street> <Number>" by hand, so the match is forgiving:
 * exact first, then a folder that contains both the street and the number.
 * Current is searched before Sold. The caller shows the match to a staff
 * member before anything reaches a vendor — this is a suggestion, not a
 * guarantee.
 */
export async function findPropertyFolder(
  streetName: string,
  number: string
): Promise<{ match: PropertyFolder | null; candidates: PropertyFolder[] }> {
  const street = norm(streetName);
  const num = norm(number);
  const wanted = `${street}${num}`;
  const candidates: PropertyFolder[] = [];

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
      const n = norm(it.name);
      const exact = n === wanted || n === `${num}${street}`;
      const loose = street && num && n.includes(street) && n.includes(num);
      if (exact || loose) {
        candidates.push({
          id: it.id,
          name: it.name,
          stage,
          path: `${PROPERTIES_ROOT}/${stage}/${it.name}`,
          webUrl: it.webUrl ?? "",
        });
      }
    }
  }

  // Prefer an exact name, then Current over Sold.
  const exact = candidates.find((c) => {
    const n = norm(c.name);
    return n === wanted || n === `${num}${street}`;
  });
  return { match: exact ?? candidates[0] ?? null, candidates };
}

/** Files directly inside MEDIA/<section> for a property folder. */
export async function listMediaSection(
  folderPath: string,
  section: "BOARD" | "BROCHURE"
): Promise<DriveFile[]> {
  let items: Item[] = [];
  try {
    items = await children(`${folderPath}/MEDIA/${section}`);
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
