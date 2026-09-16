import { NextResponse } from "next/server";
import { registerBuyer } from "@/lib/portal";
import { validSuburbIds } from "@/lib/suburbs";

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

/** Kept in step with the form. Anything else is a hand-made request, not a buyer. */
const OWNS = ["Yes", "No"];

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
  const owns = clean(body?.owns, 10);

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
    return NextResponse.json({ ok: false, error: "Please tell us which situation describes you." }, { status: 400 });
  }
  if (!OWNS.includes(owns)) {
    return NextResponse.json(
      { ok: false, error: "Please tell us whether you currently own a property." },
      { status: 400 }
    );
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
      owns,
      budget: clean(body?.budget, 40) || undefined,
      // Ids are re-validated against the suburb map — never trust the client
      // with something that ends up written into the CRM.
      suburbIds: validSuburbIds(body?.suburbIds),
      beds: clean(body?.beds, 20) || undefined,
      timeframe: clean(body?.timeframe, 40) || undefined,
      // Never inferred. Only true if they actually ticked it.
      marketingConsent: body?.marketing === true,
    });

    console.log("[portal] registered", { contactId, email, situation, owns });
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
