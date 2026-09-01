import { NextResponse } from "next/server";
import { sendEnquiry, mailIsConfigured } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LEN = 5000;

function clean(v: unknown, max = 200): string {
  return String(v ?? "").trim().slice(0, max);
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // Honeypot: a hidden field real people never fill in. Accept silently so
  // bots do not learn they were caught, but send nothing.
  if (clean(body?.company)) {
    return NextResponse.json({ ok: true });
  }

  const name = clean(body?.name);
  const email = clean(body?.email);
  const phone = clean(body?.phone, 50);
  const message = clean(body?.message, MAX_LEN);

  if (!name || !email || !message) {
    return NextResponse.json(
      { ok: false, error: "Please fill in your name, email and message." },
      { status: 400 }
    );
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "That email address doesn't look right." },
      { status: 400 }
    );
  }

  if (!mailIsConfigured()) {
    // Loud on the server, honest to the visitor. Never pretend it was sent.
    console.error("[enquiry] REJECTED — mail is not configured", { name, email });
    return NextResponse.json(
      {
        ok: false,
        error:
          "Sorry — our enquiry form is temporarily unavailable. Please call 0409 438 025 or email michael@loutakis.com.au.",
      },
      { status: 503 }
    );
  }

  try {
    await sendEnquiry({
      name,
      email,
      phone: phone || undefined,
      message,
      listingId: clean(body?.listingId, 50) || undefined,
      listingAddress: clean(body?.listingAddress) || undefined,
      pageUrl: clean(body?.pageUrl, 500) || undefined,
    });

    // Durable-ish trail in the Vercel logs alongside the email.
    console.log("[enquiry] sent", { name, email, listingId: body?.listingId ?? null });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[enquiry] SEND FAILED", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Sorry — we couldn't send that just now. Please call 0409 438 025 or email michael@loutakis.com.au.",
      },
      { status: 502 }
    );
  }
}
