import { NextResponse } from "next/server";
import { registerBuyer } from "@/lib/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITUATIONS = [
  "Buying my first home",
  "Upsizing",
  "Downsizing",
  "Investing",
  "Currently renting",
  "Just looking",
];

const clean = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

/** Australian mobile: 04xx xxx xxx, however the person spaced it. */
function normaliseMobile(input: string): string | null {
  const digits = String(input ?? "").replace(/[^\d+]/g, "").replace(/^\+61/, "0");
  return /^04\d{8}$/.test(digits) ? digits : null;
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // Honeypot — hidden field, only bots fill it. Accept silently, write nothing.
  if (clean(body?.company)) return NextResponse.json({ ok: true });

  const firstName = clean(body?.firstName, 60);
  const lastName = clean(body?.lastName, 60);
  const email = clean(body?.email, 120).toLowerCase();
  const mobile = normaliseMobile(body?.mobile);
  const situation = clean(body?.situation, 60);

  if (!firstName || !lastName) {
    return NextResponse.json({ ok: false, error: "Please give your first and last name." }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "That email address doesn't look right." }, { status: 400 });
  }
  if (!mobile) {
    return NextResponse.json(
      { ok: false, error: "Please give an Australian mobile, starting 04." },
      { status: 400 }
    );
  }
  if (!SITUATIONS.includes(situation)) {
    return NextResponse.json({ ok: false, error: "Please tell us where you're at." }, { status: 400 });
  }
  // Confidentiality is the basis on which vendors agree to be listed here, so
  // it's a hard requirement, not a tickbox we can shrug at.
  if (body?.confidentiality !== true) {
    return NextResponse.json(
      { ok: false, error: "Please agree to keep these listings confidential." },
      { status: 400 }
    );
  }

  try {
    const { contactId } = await registerBuyer({
      firstName,
      lastName,
      email,
      mobile,
      situation,
      budget: clean(body?.budget, 40) || undefined,
      suburbs: clean(body?.suburbs, 200) || undefined,
      beds: clean(body?.beds, 20) || undefined,
      timeframe: clean(body?.timeframe, 40) || undefined,
      // Never inferred. Only true if they actually ticked it.
      marketingConsent: body?.marketing === true,
    });

    console.log("[portal] registered", { contactId, email, situation });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[portal] registration failed", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Sorry — we couldn't complete your registration. Please call 0409 438 025 and we'll sort it out.",
      },
      { status: 502 }
    );
  }
}
