import { NextResponse } from "next/server";

/**
 * What Box & Dice publishes for one listing, raw and uncached — the answer to
 * "I set that in the CRM, why isn't it on the site?".
 *
 * Inspections are an array ON the sales listing (inspection_date, start_time,
 * end_time) — there is no separate endpoint. Empty fields are omitted from the
 * payload entirely, so a missing "inspections" key means none are published.
 *
 *   /api/staff/diag/listing?key=…&q=herbert
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

  /**
   * The collection is paginated oldest-first by update timestamp (per the
   * Website API docs), so a listing edited a moment ago is on the LAST page.
   * Read every page and keep the last version of each record — anything less
   * and we would be reading a stale copy and drawing conclusions from it.
   */
  const all: any[] = [];
  let next: string | null = `${base}/sales_listings`;
  let pages = 0;
  while (next && pages < 60) {
    const r: Response = await fetch(next, { headers: auth, cache: "no-store" });
    if (r.status === 204) break; // no further records
    if (!r.ok) {
      return NextResponse.json({ ok: false, page: pages, status: r.status, body: (await r.text()).slice(0, 300) }, { status: 502 });
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
      error: `no listing matching "${q}"`,
      available: records.map((l) => `${l?.property?.number ?? ""} ${l?.property?.street_name ?? ""}, ${l?.property?.suburb ?? ""}`),
    });
  }

  return NextResponse.json({
    ok: true,
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
