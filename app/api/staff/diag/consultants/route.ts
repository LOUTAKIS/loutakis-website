import { NextResponse } from "next/server";
import { getListings } from "@/lib/boxdice";
import { revalidateTag } from "next/cache";

/**
 * What Box & Dice actually publishes for each consultant — raw, uncached.
 * Answers "we changed Position in the CRM; is it in the feed yet?"
 *
 *   /api/staff/diag/consultants?key=…
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  if (!secret || url.searchParams.get("key") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const base = (process.env.BOXDICE_API_BASE ?? "https://loutakis.boxdice.com.au/website_api").replace(/\/$/, "");
  const res = await fetch(`${base}/consultants`, {
    headers: { Authorization: `Api-Key token=${process.env.BOXDICE_API_KEY}`, Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) return NextResponse.json({ ok: false, status: res.status, body: text.slice(0, 400) }, { status: 502 });

  // What the site itself serves, through the cached path. With ?refresh=1 the
  // "listings" tag is purged first, which says whether staleness is the cause.
  const titles = async () => {
    try {
      const listings = await getListings();
      const seen = new Map<string, string | null>();
      for (const l of listings) for (const a of l.agents) if (!seen.has(a.name)) seen.set(a.name, a.title ?? null);
      return Object.fromEntries(seen);
    } catch (err) {
      return { error: String(err) };
    }
  };

  const before = await titles();
  let after: unknown = null;
  if (url.searchParams.get("refresh") === "1") {
    revalidateTag("listings");
    after = await titles();
  }

  const json = JSON.parse(text);
  const list: any[] = json.consultants ?? json.data ?? json;
  return NextResponse.json({
    ok: true,
    revalidateSeconds: Number(process.env.LISTINGS_REVALIDATE_SECONDS ?? 600),
    cachedTitles: before,
    afterRefresh: after,
    count: list.length,
    // Every field on each record, so a renamed or extra title field is visible.
    consultants: list.map((c) => ({ ...c })),
  });
}
