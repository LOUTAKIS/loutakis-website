import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSignInCode, clearSignInCode, bumpSignInTries } from "@/lib/portal-store";
import { setSession } from "@/lib/portal-session";
import { recordActivity } from "@/lib/portal-activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TRIES = 5;

/**
 * The six digits from the sign-in email, entered on the device that asked for
 * them. Single use, fifteen minutes, and five wrong guesses burns the code —
 * six digits are only secret while guessing is expensive.
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const entered = String(body?.code ?? "").replace(/\D/g, "");
  const device = cookies().get("lre_dev")?.value ?? "";
  const wrong = NextResponse.json(
    { ok: false, error: "That code doesn't match. Check the email, or request a new one." },
    { status: 400 }
  );

  if (entered.length !== 6 || !device) return wrong;

  const stored = await readSignInCode(device);
  if (!stored) return wrong;

  if (Date.now() > stored.expires || stored.tries >= MAX_TRIES) {
    await clearSignInCode(device);
    return NextResponse.json(
      { ok: false, error: "That code has expired. Request a new one." },
      { status: 400 }
    );
  }

  if (entered !== stored.code) {
    await bumpSignInTries(stored);
    return wrong;
  }

  await clearSignInCode(device);
  setSession(String(stored.contactId));
  // Awaited deliberately: the redirect that follows lands on a page which
  // reads this log, and a write that has not happened yet reads as never.
  await recordActivity(stored.contactId, { k: "signin" });
  return NextResponse.json({ ok: true });
}
