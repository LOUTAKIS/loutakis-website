import { getCampaign } from "@/lib/campaigns";
import { downloadFile } from "@/lib/sharepoint";
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
 */
export async function GET(req: Request, { params }: { params: { id: string; kind: string } }) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const payload = verifyToken(token);
  const vendorOk = payload?.a === "vendor" && payload.c === params.id;
  const staffOk = Boolean(getStaff());
  if (!vendorOk && !staffOk) return new Response("Not found", { status: 404 });

  const c = await getCampaign(params.id);
  if (!c) return new Response("Not found", { status: 404 });

  const itemId = params.kind === "board" ? c.selection.boardId : params.kind === "brochure" ? c.selection.brochureId : null;
  const name = params.kind === "board" ? c.selection.boardName : c.selection.brochureName;
  if (!itemId) return new Response("Not found", { status: 404 });

  try {
    const upstream = await downloadFile(itemId);
    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream");
    const len = upstream.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    headers.set("Content-Disposition", `inline; filename="${(name ?? params.kind).replace(/"/g, "")}"`);
    headers.set("Cache-Control", "private, max-age=300");
    headers.set("X-Robots-Tag", "noindex");
    return new Response(upstream.body, { status: 200, headers });
  } catch (err) {
    console.error("[vendor file] download failed", err);
    return new Response("Unavailable", { status: 502 });
  }
}
