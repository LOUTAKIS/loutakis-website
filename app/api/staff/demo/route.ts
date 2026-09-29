import { NextResponse } from "next/server";
import { getStaff } from "@/lib/staff-auth";
import { getCampaign } from "@/lib/campaigns";
import { setDemoCampaign } from "@/lib/demo-approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Choose which campaign the example approval page shows, or take it down.
 *
 * The campaign is READ AND STORED WHOLE, not pointed at. The example should be
 * the same page a seller was shown last month, and stay that way until somebody
 * here decides otherwise — so it must not follow the campaign into "approved",
 * into an edit, or into the bin.
 *
 * It is also fetched rather than trusted, because the stored id is what the
 * file route compares against when it decides to serve a board to someone
 * holding only the shared password. A typo would be harmless; an unchecked id
 * is a door.
 */
export async function POST(req: Request) {
  const staff = getStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "").trim();

  if (!id) {
    await setDemoCampaign(null, staff.email);
    console.log(`[demo] example approval taken down by ${staff.email}`);
    return NextResponse.json({ ok: true, address: null });
  }

  const c = await getCampaign(id);
  if (!c) return NextResponse.json({ ok: false, error: "No such campaign" }, { status: 400 });

  await setDemoCampaign(c, staff.email);
  console.log(`[demo] example approval frozen as ${c.address} by ${staff.email}`);
  return NextResponse.json({ ok: true, address: c.address });
}
