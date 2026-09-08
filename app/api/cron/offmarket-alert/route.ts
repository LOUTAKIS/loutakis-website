import { NextResponse } from "next/server";
import { runOffMarketAlerts } from "@/lib/portal-alerts";
import { refreshInstagramToken } from "@/lib/instagram";

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

    /**
     * Piggy-backed on the same nightly run rather than given a cron of its
     * own: an Instagram long-lived token dies for good if it goes 60 days
     * without a refresh, and one job that always runs is safer than two that
     * might not. Never fatal to the alerts above.
     */
    const instagram = await refreshInstagramToken();
    if (!instagram.ok) console.error("[instagram] token refresh failed:", instagram.detail);
    else console.log("[instagram]", instagram.detail);

    return NextResponse.json({ ok: true, ...result, instagram });
  } catch (err) {
    console.error("[alerts] run failed", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
