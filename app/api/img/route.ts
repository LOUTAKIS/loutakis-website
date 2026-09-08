import { verify } from "@/lib/image-proxy";

export const runtime = "nodejs";

/**
 * A listing photograph, fetched once and then served from our CDN.
 *
 * Cached for a year and marked immutable: Box & Dice mint a new URL whenever a
 * photo changes, so a URL that has been seen once will never point at different
 * bytes. That means one request to their servers per photograph, ever — which
 * is what their no-hotlinking rule is really asking for.
 *
 * Range requests are passed straight through so the dimension reader in
 * lib/image-meta can ask for the first 64KB rather than a whole photograph.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("u") ?? "";
  const sig = searchParams.get("s") ?? "";

  if (!verify(url, sig)) {
    // Deliberately terse: an open proxy probe learns nothing about why.
    return new Response("Not found", { status: 404 });
  }

  const range = req.headers.get("range");

  try {
    const upstream = await fetch(url, {
      headers: range ? { Range: range } : undefined,
      // Vercel's own cache is what we rely on; don't also hold it in memory.
      cache: "no-store",
    });

    if (!upstream.ok && upstream.status !== 206) {
      console.error(`[img] upstream ${upstream.status} for ${url}`);
      // 502, not 404: the photo exists, we just could not reach it. A 404 would
      // invite the CDN and crawlers to treat the image as permanently gone.
      return new Response("Upstream unavailable", { status: 502 });
    }

    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("content-type") ?? "image/jpeg");
    const len = upstream.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    const contentRange = upstream.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=86400, s-maxage=31536000, immutable");

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    console.error("[img] fetch failed", url, err);
    return new Response("Upstream unavailable", { status: 502 });
  }
}
