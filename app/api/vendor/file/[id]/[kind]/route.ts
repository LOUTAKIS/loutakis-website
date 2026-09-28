import { getCampaign } from "@/lib/campaigns";
import { downloadFile } from "@/lib/sharepoint";
import { resolveCampaignFile, type FileKind } from "@/lib/vendor-files";
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
 * Which file to send is resolved by lib/vendor-files.ts, the same code that
 * checks a campaign before its link is emailed. One resolver for both, so the
 * check and the serve can never disagree about whether a campaign is ready.
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

  if (params.kind !== "board" && params.kind !== "brochure") {
    return new Response("Not found", { status: 404 });
  }
  const kind = params.kind as FileKind;

  const c = await getCampaign(params.id);
  if (!c) return new Response("Not found", { status: 404 });

  const resolved = await resolveCampaignFile(c, kind);
  if (!resolved.ok) {
    console.error(`[vendor file] ${kind} unavailable: ${resolved.reason}`);
    return new Response("Unavailable", { status: 502 });
  }
  if (!resolved.id) return new Response("Not found", { status: 404 });

  let upstream: Response;
  try {
    upstream = await downloadFile(resolved.id);
  } catch (err) {
    console.error(`[vendor file] ${kind} download failed after resolving`, err);
    return new Response("Unavailable", { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream");
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  headers.set("Content-Disposition", `inline; filename="${resolved.name.replace(/"/g, "")}"`);
  /**
   * Not cached at all while a file has just been healed — a stale 5-minute
   * copy of a broken response is exactly what would make this look unfixed.
   */
  headers.set("Cache-Control", resolved.healed ? "no-store" : "private, max-age=300");
  headers.set("X-Robots-Tag", "noindex");
  return new Response(upstream.body, { status: 200, headers });
}
