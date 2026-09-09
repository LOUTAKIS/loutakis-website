import { NextResponse } from "next/server";
import { getStaff } from "@/lib/staff-auth";
import { getSiteStats, analyticsConfigured } from "@/lib/web-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What Vercel's Web Analytics API actually returns for this project.
 *
 * The Website page was written against the published documentation but could
 * not be run against the live API before deploying — there is no way to reach
 * api.vercel.com from a build. So this exists to answer "the page says zero,
 * is that true or is it us?" with the raw responses rather than a guess.
 *
 * Read-only, staff-only, and it never returns the token.
 */
export async function GET() {
  if (!getStaff()) {
    return NextResponse.json({ ok: false, error: "Sign in at /staff first" }, { status: 401 });
  }

  const env = {
    VERCEL_API_TOKEN: Boolean(process.env.VERCEL_API_TOKEN),
    VERCEL_PROJECT_ID: Boolean(process.env.VERCEL_PROJECT_ID),
    VERCEL_TEAM_ID: Boolean(process.env.VERCEL_TEAM_ID),
    configured: analyticsConfigured(),
  };

  const stats = await getSiteStats(30).catch((err) => ({
    error: err instanceof Error ? err.message : String(err),
  }));

  return NextResponse.json({
    env,
    /**
     * `missing` names the queries that failed. If a query failed, the reason is
     * in the Vercel runtime logs — the fetch logs status and body there rather
     * than returning them here, because an error body can echo the request.
     */
    stats,
  });
}
