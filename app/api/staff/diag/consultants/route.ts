import { NextResponse } from "next/server";

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

  const json = JSON.parse(text);
  const list: any[] = json.consultants ?? json.data ?? json;
  return NextResponse.json({
    ok: true,
    count: list.length,
    // Every field on each record, so a renamed or extra title field is visible.
    consultants: list.map((c) => ({ ...c })),
  });
}
