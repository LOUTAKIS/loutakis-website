import { getCampaign } from "@/lib/campaigns";
import { panelSig, renderBrochure } from "@/lib/brochure-render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One brochure panel as a JPEG. The signature in the path is derived from the
 * campaign and the brochure file, so the URL is unguessable and immutable —
 * the CDN keeps it for a year, and a new brochure file gets a new URL.
 */
export async function GET(_req: Request, { params }: { params: { id: string; sig: string; file: string } }) {
  const m = params.file.match(/^([01])-([0-3])\.jpg$/);
  if (!m) return new Response("Not found", { status: 404 });

  const c = await getCampaign(params.id);
  const brochureId = c?.selection.brochureId;
  if (!c || !brochureId || panelSig(c.id, brochureId) !== params.sig) return new Response("Not found", { status: 404 });

  try {
    const r = await renderBrochure(brochureId);
    const buf = r.panels[Number(m[1])][Number(m[2])];
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(buf.length),
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (err) {
    console.error("[brochure panel] render failed", err);
    return new Response("Unavailable", { status: 502 });
  }
}
