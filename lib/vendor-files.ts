import "server-only";
import { fileMeta, listMediaSection, findPropertyFolder, type DriveFile } from "./sharepoint";
import { updateCampaign, type Campaign } from "./campaigns";

/**
 * Making sure a campaign's board and brochure are actually there.
 *
 * WHY THIS EXISTS. 19 William Street's board was a broken image on the page we
 * ask a vendor to approve, and nobody knew until someone happened to look. The
 * campaign stores the SharePoint item id at the moment it is assembled, and
 * that id dies as soon as anyone re-exports the artwork and uploads it again:
 * SharePoint treats the replacement as a new item, and the id we kept points
 * at nothing.
 *
 * One resolver, used in two places on purpose — when the file is served, and
 * again before a vendor is emailed. If those two ever disagreed about whether
 * a campaign was ready, the disagreement would show up as a vendor looking at
 * a broken page, which is the failure this is meant to end.
 */

export type FileKind = "board" | "brochure";

export type Resolved =
  | { ok: true; id: string; name: string; healed: boolean }
  /** No file of this kind was chosen. Not a fault — some campaigns have no board. */
  | { ok: true; id: null; name: null; healed: false }
  | { ok: false; reason: string; recoverable: boolean };

const SECTION = { board: "BOARD", brochure: "BROCHURE" } as const;

/**
 * The item id to use right now, healing the record if it has drifted.
 *
 * Re-resolution matches by NAME rather than taking the newest file in the
 * folder. The newest might be something nobody reviewed, and the vendor page is
 * the record of what was approved — quietly swapping in a different design
 * would be worse than the broken image. Newest is the last resort, and it says
 * so in the logs when it happens.
 */
export async function resolveCampaignFile(c: Campaign, kind: FileKind): Promise<Resolved> {
  const id = kind === "board" ? c.selection.boardId : c.selection.brochureId;
  const name = kind === "board" ? c.selection.boardName : c.selection.brochureName;
  if (!id) return { ok: true, id: null, name: null, healed: false };

  let status = 0;
  try {
    const meta = await fileMeta(id);
    if (meta.ok) return { ok: true, id, name: meta.name || name || kind, healed: false };
    status = meta.status;
  } catch (err) {
    console.error(`[vendor files] ${kind} metadata read threw`, err);
  }

  /**
   * 401 and 403 are the app registration, not the file. Looking again in the
   * same folder uses the same credential and will fail the same way — saying
   * so is more use than a second failure with a vaguer message.
   */
  if (status === 401 || status === 403) {
    return {
      ok: false,
      reason: `SharePoint refused the request (${status}). That's the Graph credential, not the file.`,
      recoverable: false,
    };
  }

  if (!c.folderId && !c.folderPath) {
    return {
      ok: false,
      reason: `The ${kind} file is gone from SharePoint and this campaign has no folder recorded, so it can't be found again. Re-pick it on the review screen.`,
      recoverable: false,
    };
  }

  let files: DriveFile[] = [];
  try {
    files = await listMediaSection({ id: c.folderId, path: c.folderPath }, SECTION[kind]);
  } catch (err) {
    console.error(`[vendor files] ${kind} folder read failed`, err);
    return { ok: false, reason: `Couldn't read the ${kind} folder in SharePoint.`, recoverable: false };
  }

  if (!files.length) {
    return {
      ok: false,
      reason: `There's nothing in the ${SECTION[kind]} folder for this property any more.`,
      recoverable: false,
    };
  }

  // `name &&` would make this the empty string rather than undefined when a
  // campaign has no filename recorded, which is not a DriveFile.
  const byName = name ? files.find((f) => f.name.toLowerCase() === name.toLowerCase()) : undefined;
  const match = byName ?? [...files].sort((a, b) => b.modified.localeCompare(a.modified))[0];
  if (!byName) {
    console.warn(
      `[vendor files] ${kind} "${name}" is gone; falling back to the newest file, "${match.name}". Worth checking it is the artwork that was reviewed.`
    );
  }

  // Heal the record so the next read doesn't pay for this again. Never fatal.
  updateCampaign(c.id, {
    selection: {
      ...c.selection,
      ...(kind === "board"
        ? { boardId: match.id, boardName: match.name }
        : { brochureId: match.id, brochureName: match.name }),
    },
  }).catch((e) => console.error(`[vendor files] couldn't heal the stored ${kind} id`, e));

  console.log(`[vendor files] ${kind} recovered as ${match.name} (${match.id})`);
  return { ok: true, id: match.id, name: match.name, healed: true };
}

/**
 * Everything this campaign will try to show a vendor, checked.
 *
 * Called before the link is emailed. A vendor should never be the one to
 * discover that the artwork is missing — they are being asked to authorise
 * money on the strength of what is on that page.
 */
export async function checkCampaignFiles(
  c: Campaign
): Promise<{ ok: boolean; problems: string[]; healed: FileKind[] }> {
  const problems: string[] = [];
  const healed: FileKind[] = [];

  for (const kind of ["board", "brochure"] as FileKind[]) {
    const r = await resolveCampaignFile(c, kind);
    if (!r.ok) problems.push(`${kind === "board" ? "Board" : "Brochure"}: ${r.reason}`);
    else if (r.healed) healed.push(kind);
  }

  return { ok: problems.length === 0, problems, healed };
}

/**
 * Find this campaign's SharePoint folder, looking again if we have none.
 *
 * The review screen used to say "create the folder and re-open this page", and
 * re-opening did nothing: the folder was resolved once when the campaign was
 * created and never again, so a folder made five minutes later was invisible
 * for good. Now every visit to the review screen looks, and a folder found
 * late is written back onto the campaign.
 */
export async function ensureCampaignFolder(
  c: Campaign
): Promise<{ id: string | null; path: string | null }> {
  if (c.folderId || c.folderPath) return { id: c.folderId ?? null, path: c.folderPath ?? null };
  if (!c.street && !c.number) return { id: null, path: null };

  try {
    const { match } = await findPropertyFolder(c.street, c.number);
    if (!match) return { id: null, path: null };
    await updateCampaign(c.id, { folderId: match.id, folderPath: match.path });
    console.log(`[campaign ${c.id}] folder found on re-open: ${match.path}`);
    return { id: match.id, path: match.path };
  } catch (err) {
    console.error(`[campaign ${c.id}] folder re-resolve failed`, err);
    return { id: null, path: null };
  }
}
