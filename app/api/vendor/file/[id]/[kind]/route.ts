import { getCampaign, updateCampaign } from "@/lib/campaigns";
import { downloadFile, listMediaSection, type DriveFile } from "@/lib/sharepoint";
import { verifyToken } from "@/lib/portal-token";
import { getStaff } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streams the board or brochure for a campaign.
 *
 * SharePoint is never exposed: the vendor's browser asks us, we ask Graph with
 * the app credential, and the bytes pass through. Access is the vendor's own
 * link token or a staff session — the URL alone gets nothing.
 *
 * THE STORED ITEM ID GOES STALE. A campaign records the file's id when it is
 * assembled, and that id dies the moment someone re-exports the artwork and
 * uploads it again: SharePoint treats the replacement as a new item, the old
 * id 404s from Graph, and the vendor sees a broken image on the page we asked
 * them to approve. That is exactly what happened to 19 William Street.
 *
 * So a failed download is not the end. The campaign knows which folder the
 * property lives in and what the file was CALLED, and a re-upload almost always
 * keeps the name — so we look it up again by name and carry on. Matching by
 * name rather than taking the newest file matters: the newest might be
 * something nobody reviewed, and this page is a record of what was approved.
 */
export async function GET(req: Request, { params }: { params: { id: string; kind: string } }) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const payload = verifyToken(token);
  // The token's subject is "<campaign id>:<vendor index>" — any vendor's link
  // may read the files for their own campaign.
  const vendorOk = payload?.a === "vendor" && String(payload.c).split(":")[0] === params.id;
  const staffOk = Boolean(getStaff());
  if (!vendorOk && !staffOk) return new Response("Not found", { status: 404 });

  const c = await getCampaign(params.id);
  if (!c) return new Response("Not found", { status: 404 });

  const isBoard = params.kind === "board";
  const section = isBoard ? "BOARD" : params.kind === "brochure" ? "BROCHURE" : null;
  if (!section) return new Response("Not found", { status: 404 });

  const itemId = isBoard ? c.selection.boardId : c.selection.brochureId;
  const name = isBoard ? c.selection.boardName : c.selection.brochureName;
  if (!itemId) return new Response("Not found", { status: 404 });

  let upstream: Response | null = null;
  try {
    upstream = await downloadFile(itemId);
  } catch (err) {
    console.error(`[vendor file] ${section} ${itemId} failed, re-resolving by name`, err);

    /**
     * Second chance, by name. Best effort and loud in the logs either way —
     * if this also fails the cause is the Graph credential or the folder
     * itself, and the next person to look needs to see both errors.
     */
    if (c.folderPath) {
      try {
        const files = await listMediaSection(c.folderPath, section);
        const match: DriveFile | undefined =
          (name && files.find((f) => f.name.toLowerCase() === name.toLowerCase())) ||
          [...files].sort((a, b) => b.modified.localeCompare(a.modified))[0];

        if (match) {
          upstream = await downloadFile(match.id);
          console.log(`[vendor file] ${section} recovered as ${match.name} (${match.id})`);

          /**
           * Heal the record so the next open doesn't pay for this again. Never
           * fatal: the bytes are already on their way, and a failed write is
           * one slow request rather than a broken page.
           */
          updateCampaign(c.id, {
            selection: {
              ...c.selection,
              ...(isBoard
                ? { boardId: match.id, boardName: match.name }
                : { brochureId: match.id, brochureName: match.name }),
            },
          }).catch((e) => console.error("[vendor file] could not heal the stored id", e));
        }
      } catch (e) {
        console.error(`[vendor file] ${section} re-resolve failed too`, e);
      }
    }
  }

  if (!upstream) return new Response("Unavailable", { status: 502 });

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream");
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  headers.set("Content-Disposition", `inline; filename="${(name ?? params.kind).replace(/"/g, "")}"`);
  headers.set("Cache-Control", "private, max-age=300");
  headers.set("X-Robots-Tag", "noindex");
  return new Response(upstream.body, { status: 200, headers });
}
