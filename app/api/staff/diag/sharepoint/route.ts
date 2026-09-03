import { NextResponse } from "next/server";
import { findPropertyFolder, listMediaSection } from "@/lib/sharepoint";

/**
 * Proves the SharePoint read path end to end, from Vercel, where the app
 * secret lives. Locked behind CRON_SECRET.
 *
 *   /api/staff/diag/sharepoint?key=…&street=Laurie&number=9
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  if (!secret || url.searchParams.get("key") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const street = url.searchParams.get("street") ?? "";
  const number = url.searchParams.get("number") ?? "";

  try {
    const { match, candidates } = await findPropertyFolder(street, number);
    const board = match ? await listMediaSection(match.path, "BOARD") : [];
    const brochure = match ? await listMediaSection(match.path, "BROCHURE") : [];
    return NextResponse.json({
      ok: true,
      lookedFor: { street, number },
      match,
      otherCandidates: candidates.filter((c) => c.id !== match?.id),
      board: board.map(({ name, size, mime }) => ({ name, size, mime })),
      brochure: brochure.map(({ name, size, mime }) => ({ name, size, mime })),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
