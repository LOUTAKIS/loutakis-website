import { NextResponse } from "next/server";

/**
 * What Box & Dice publishes for one listing, raw and uncached — the answer to
 * "I set that in the CRM, why isn't it on the site?".
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
  const res = await fetch(`${base}/sales_listings`, { headers: auth, cache: "no-store" });
  const text = await res.text();
  if (!res.ok) return NextResponse.json({ ok: false, status: res.status, body: text.slice(0, 400) }, { status: 502 });

  const json = JSON.parse(text);
  const all: any[] = json.sales_listings ?? json.data ?? [];
  const matches = q
    ? all.filter((l) => `${l?.property?.street_name ?? ""} ${l?.property?.suburb ?? ""}`.toLowerCase().includes(q))
    : all.slice(0, 1);
  // Prefer a live campaign over an old settled one when a street has both.
  const hit = matches.find((l) => String(l.status).toLowerCase() === "current") ?? matches[0];

  /**
   * Inspections are not on the listing record. Try the endpoints Box & Dice
   * might publish them under, so we know whether they exist at all.
   */
  const probes: Record<string, string> = {};
  for (const path of ["/inspections", "/open_homes", "/inspection_times", `/sales_listings/${hit?.id}/inspections`]) {
    try {
      const r = await fetch(base + path, { headers: auth, cache: "no-store" });
      const body = await r.text();
      probes[path] = `${r.status} ${body.slice(0, 160)}`;
    } catch (err) {
      probes[path] = `error ${String(err)}`;
    }
  }

  if (!hit) {
    return NextResponse.json({
      ok: false,
      error: `no listing matching "${q}"`,
      available: all.map((l) => `${l?.property?.number ?? ""} ${l?.property?.street_name ?? ""}, ${l?.property?.suburb ?? ""}`),
    });
  }

  return NextResponse.json({
    ok: true,
    matched: matches.map((l) => ({ id: l.id, status: l.status, website_status: l.website_status, address: `${l?.property?.number ?? ""} ${l?.property?.street_name ?? ""}` })),
    inspectionEndpoints: probes,
    id: hit.id,
    status: hit.status,
    address: `${hit?.property?.number ?? ""} ${hit?.property?.street_name ?? ""}, ${hit?.property?.suburb ?? ""}`,
    inspections: hit.inspections ?? null,
    auction: { date: hit.auction_date ?? null, time: hit.auction_time ?? null },
    // Anything else that might carry inspection times under another name.
    keys: Object.keys(hit).sort(),
  });
}
