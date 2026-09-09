import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getStaff } from "@/lib/staff-auth";
import { saveReaDays, type ReaDays } from "@/lib/rea-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Save the median-days figures read off REA.
 *
 * Only these three numbers are stored. Sold counts and median prices are
 * computed from the CRM on every render, so there is nothing to save and
 * nothing that can go stale.
 */
export async function POST(req: Request) {
  const staff = getStaff();
  if (!staff) {
    return NextResponse.json({ ok: false, error: "Sign in at /staff first" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  // "20.5", "21 days" — someone is copying off a web page, not filling in a form.
  const days: Record<string, number> = {};
  for (const [type, value] of Object.entries(body.days ?? {})) {
    const n = Number(String(value ?? "").replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n > 0 && n < 3650) days[type.slice(0, 40)] = n;
  }

  if (!Object.keys(days).length) {
    return NextResponse.json(
      { ok: false, error: "Add a median days figure for at least one property type." },
      { status: 400 }
    );
  }

  const value: ReaDays = {
    days,
    checkedOn: String(body.checkedOn ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    checkedBy: staff.email,
    published: body.published === true,
  };

  try {
    await saveReaDays(value);
  } catch (err) {
    console.error("[market] save failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Could not save." },
      { status: 502 }
    );
  }

  revalidateTag("sales-stats");
  revalidatePath("/sell-with-us");
  revalidatePath("/staff/market");

  return NextResponse.json({ ok: true, saved: value });
}
