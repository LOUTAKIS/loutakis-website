import { NextResponse } from "next/server";
import { checkPassword, unlock, demoConfigured } from "@/lib/demo-approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The password on the example approval page.
 *
 * Deliberately vague on failure and identical in shape either way: there is
 * nothing here worth defending hard, but a route that says "no such password
 * configured" tells a stranger more about the system than it needs to.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!demoConfigured() || !body) return NextResponse.json({ ok: false }, { status: 401 });

  if (!checkPassword(String(body?.password ?? ""))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  unlock();
  return NextResponse.json({ ok: true });
}
