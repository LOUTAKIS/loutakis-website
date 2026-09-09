import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getStaff } from "@/lib/staff-auth";
import { saveReaStats, type ReaSnapshot, type ReaTypeRow } from "@/lib/rea-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const num = (v: unknown): number => {
  // "$985k", "985,000", "20.5 days" — staff are copying off a web page, not
  // filling in a form designed by an accountant.
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** "985k" and "0.99m" are how REA writes it; store the real number. */
const price = (v: unknown): number => {
  const s = String(v ?? "").toLowerCase();
  const n = num(s);
  if (/m\b/.test(s) && n < 100) return Math.round(n * 1_000_000);
  if (/k\b/.test(s) && n < 10_000) return Math.round(n * 1000);
  return Math.round(n);
};

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

  const rows: ReaTypeRow[] = (Array.isArray(body.rows) ? body.rows : [])
    .map((r: any) => ({
      type: String(r?.type ?? "").slice(0, 40),
      sold: Math.round(num(r?.sold)),
      medianPrice: price(r?.medianPrice),
      medianDays: num(r?.medianDays),
    }))
    // A row with no sales is a row REA isn't showing either.
    .filter((r: ReaTypeRow) => r.type && r.sold > 0);

  if (!rows.length) {
    return NextResponse.json(
      { ok: false, error: "Add at least one property type with a sold count." },
      { status: 400 }
    );
  }

  const snapshot: ReaSnapshot = {
    totalSold: Math.round(num(body.totalSold)),
    medianPrice: price(body.medianPrice),
    rows,
    checkedOn: String(body.checkedOn ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    checkedBy: staff.email,
    published: body.published === true,
  };

  try {
    await saveReaStats(snapshot);
  } catch (err) {
    console.error("[market] save failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Could not save." },
      { status: 502 }
    );
  }

  // The Sell with us page renders these, so it has to be told they changed.
  revalidateTag("sales-stats");
  revalidatePath("/sell-with-us");
  revalidatePath("/staff/market");

  return NextResponse.json({ ok: true, saved: snapshot });
}
