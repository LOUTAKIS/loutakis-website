import { NextResponse } from "next/server";
import { getStaff } from "@/lib/staff-auth";
import { getCampaign } from "@/lib/campaigns";
import { setDemoCampaignId } from "@/lib/demo-approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Choose which campaign the example approval page shows, or take it down.
 *
 * The id is CHECKED AGAINST A REAL CAMPAIGN before it is stored, because this
 * value is what the file routes compare against when they decide to serve a
 * board or a brochure to someone holding only the shared password. A typo here
 * would be harmless; an unchecked id is a door.
 */
export async function POST(req: Request) {
  const staff = getStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "").trim();

  if (!id) {
    await setDemoCampaignId(null);
    console.log(`[demo] example approval taken down by ${staff.email}`);
    return NextResponse.json({ ok: true, address: null });
  }

  const c = await getCampaign(id);
  if (!c) return NextResponse.json({ ok: false, error: "No such campaign" }, { status: 400 });

  await setDemoCampaignId(c.id);
  console.log(`[demo] example approval set to ${c.address} by ${staff.email}`);
  return NextResponse.json({ ok: true, address: c.address });
}
