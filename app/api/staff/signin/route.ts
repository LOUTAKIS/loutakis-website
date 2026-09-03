import { NextResponse } from "next/server";
import { sendStaffSignIn } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Always answers ok — the allowlist is not something to probe from outside. */
export async function POST(req: Request) {
  let email = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "");
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    await sendStaffSignIn(email);
  } catch (err) {
    console.error("[staff] sign-in email failed", err);
  }
  return NextResponse.json({ ok: true });
}
