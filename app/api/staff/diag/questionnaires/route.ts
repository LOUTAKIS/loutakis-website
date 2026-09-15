import { NextResponse } from "next/server";
import { getStaff } from "@/lib/staff-auth";
import { listQuestionnaires, lastReadError } from "@/lib/questionnaire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Why the questionnaires page is empty, or wasn't.
 *
 * A read that returns null cannot tell an empty store from a bad token, and
 * the page is now built so neither takes it down — which is right for a vendor
 * at nine at night and useless when you are trying to work out what broke. This
 * says which it is, and it is the first thing to open if that page ever looks
 * wrong again. Staff only.
 */
export async function GET() {
  if (!getStaff()) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const env = {
    VERCEL_API_TOKEN: Boolean(process.env.VERCEL_API_TOKEN),
    GLOBAL_CONFIG: Boolean(process.env.GLOBAL_CONFIG),
    GLOBAL_CONFIG_ID: process.env.GLOBAL_CONFIG_ID ?? "(default)",
    VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID ?? "(default)",
    PORTAL_TOKEN_SECRET: Boolean(process.env.PORTAL_TOKEN_SECRET),
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "(unset)",
  };

  try {
    const all = await listQuestionnaires();
    return NextResponse.json({
      ok: true,
      env,
      readError: lastReadError,
      count: all.length,
      rows: all.map((q) => ({
        id: q.id,
        address: q.address,
        status: q.status,
        sentAt: q.sentAt,
        submittedAt: q.submittedAt,
        answered: Object.keys(q.answers ?? {}).length,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, env, error: (err as Error)?.message ?? String(err), stack: (err as Error)?.stack },
      { status: 500 }
    );
  }
}
