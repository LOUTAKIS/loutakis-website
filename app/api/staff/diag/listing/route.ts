import { NextResponse } from "next/server";

/**
 * What Box & Dice publishes for one listing, raw and uncached — the answer to
 * "I set that in the CRM, why isn't it on the site?".
 *
 * Inspections are an array ON the sales listing (inspection_date, start_time,
 * end_time) — there is no separate endpoint. Empty fields are omitted from the
 * payload entirely, so a missing "inspections" key means none are published.
 *
 *   /api/staff/diag/listing?key=…&q=herbert&since=24
 *
 * `since` (hours) uses the documented `after` cursor so we read only recently
 * updated records rather than crawling the whole rate-limited collection.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  if (!secret || url.searchParams.get("key") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const q = (url.searchParams.get("q") ?? "").toLowerCase();
  const auth = { Authorization: `Api-Key token=${process.env.BOXDICE_API_KEY}`, Accept: "application/json" };
  const base = (process.env.BOXDICE_API_BASE ?? "https://loutakis.boxdice.com.au/website_api").replace(/\/$/, "");

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /**
   * Respect Retry-After, as the docs require: the collection is rate limited
   * per endpoint (10s between 200s by default) and answers 429 if you push.
   */
  async function get(u: string): Promise<Response> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const r = await fetch(u, { headers: auth, cache: "no-store" });
      if (r.status !== 429) return r;
      const wait = Math.min(15, Number(r.headers.get("retry-after") ?? 10)) * 1000;
      await sleep(wait);
    }
    return fetch(u, { headers: auth, cache: "no-store" });
  }

  /**
   * The collection is paginated oldest-first by update timestamp, so a listing
   * edited a moment ago sits on the LAST page. Rather than crawl every page
   * (slow, and rate limited), ask for everything updated since a point in time
   * — `after` is the documented cursor parameter. `since` is in hours.
   */
  const sinceHours = Number(url.searchParams.get("since") ?? 24);
  const afterISO = new Date(Date.now() - sinceHours * 3600_000).toISOString();

  const all: any[] = [];
  let next: string | null = `${base}/sales_listings?after=${encodeURIComponent(afterISO)}`;
  let pages = 0;
  const deadline = Date.now() + 40_000;
  while (next && pages < 25 && Date.now() < deadline) {
    const r: Response = await get(next);
    if (r.status === 204) break; // caught up: no newer records
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, page: pages, status: r.status, body: (await r.text()).slice(0, 300), hint: "Wait a minute and retry — the feed is rate limited per endpoint." },
        { status: 502 }
      );
    }
    const j: any = await r.json();
    all.push(...(j.sales_listings ?? j.data ?? []));
    next = j.paging?.next ?? j.next ?? null;
    pages++;
  }

  // Later pages hold newer versions of the same id — keep the last one seen.
  const latest = new Map<number, any>();
  for (const l of all) latest.set(Number(l.id), l);
  const records = [...latest.values()];

  const matches = q
    ? records.filter((l) => `${l?.property?.number ?? ""} ${l?.property?.street_name ?? ""} ${l?.property?.suburb ?? ""}`.toLowerCase().includes(q))
    : records.slice(0, 1);
  const hit = matches.find((l) => String(l.website_status).toLowerCase() === "current") ?? matches[0];

  if (!hit) {
    return NextResponse.json({
      ok: false,
      error: `no listing matching "${q}" was updated in the last ${sinceHours}h`,
      updatedSince: afterISO,
      pagesRead: pages,
      available: records.map((l) => `${l?.property?.number ?? ""} ${l?.property?.street_name ?? ""}, ${l?.property?.suburb ?? ""}`),
    });
  }

  return NextResponse.json({
    ok: true,
    updatedSince: afterISO,
    pagesRead: pages,
    listingsSeen: records.length,
    matched: matches.map((l) => ({ id: l.id, status: l.status, website_status: l.website_status, address: `${l?.property?.number ?? ""} ${l?.property?.street_name ?? ""}` })),
    id: hit.id,
    status: hit.status,
    address: `${hit?.property?.number ?? ""} ${hit?.property?.street_name ?? ""}, ${hit?.property?.suburb ?? ""}`,
    inspections: hit.inspections ?? null,
    auction: { date: hit.auction_date ?? null, time: hit.auction_time ?? null },
    // Anything else that might carry inspection times under another name.
    keys: Object.keys(hit).sort(),
  });
}
