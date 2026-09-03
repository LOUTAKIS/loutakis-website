import { NextResponse } from "next/server";
import { runOffMarketAlerts } from "@/lib/portal-alerts";

/**
 * Daily check for newly tagged off-market listings, emailing the approved list
 * when there's something new. Scheduled in vercel.json.
 *
 * Vercel signs cron requests with CRON_SECRET; we also accept the same secret
 * as ?key= so it can be run by hand from a phone ("send it now") without
 * waiting for tomorrow. Add ?dry=1 to see what would happen and send nothing.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const auth = req.headers.get("authorization");

  const allowed =
    !secret || auth === `Bearer ${secret}` || url.searchParams.get("key") === secret;
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  try {
    const result = await runOffMarketAlerts(url.searchParams.get("dry") === "1");
    console.log("[alerts] run complete", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[alerts] run failed", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
