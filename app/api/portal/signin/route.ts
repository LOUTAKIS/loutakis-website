import { NextResponse } from "next/server";
import { lookupContactId, storeConfigured } from "@/lib/portal-store";
import { getContact, CATEGORY_APPROVED, CATEGORY_PENDING } from "@/lib/portal";
import { createSignInToken } from "@/lib/portal-token";
import { sendMail, esc } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? "https://loutakis-website.vercel.app").replace(/\/$/, "");

/**
 * "Email me a sign-in link."
 *
 * Deliberately answers the same way whether or not the identifier is known:
 * "if that's registered, a link is on its way." Otherwise the form becomes a
 * way to test which emails and mobiles are on your off-market list.
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const identifier = String(body?.identifier ?? "").trim();
  if (!identifier) {
    return NextResponse.json(
      { ok: false, error: "Enter the email or mobile you registered with." },
      { status: 400 }
    );
  }

  const neutral = NextResponse.json({ ok: true });

  if (!storeConfigured().read) {
    console.error("[portal] sign-in requested but the store isn't configured");
    return neutral;
  }

  try {
    const contactId = await lookupContactId(identifier);
    if (!contactId) return neutral;

    const contact = await getContact(contactId);
    const email = String(contact?.email ?? "").trim();
    if (!email) return neutral;

    const names = (contact?.categories ?? []).map((c: any) => String(c?.name ?? c));
    const approved = names.includes(CATEGORY_APPROVED);
    const pending = names.includes(CATEGORY_PENDING);

    if (!approved) {
      // Tell them where they stand — but only via the email on file, which is
      // the same proof-of-inbox the sign-in link relies on.
      if (pending) {
        await sendMail({
          to: [email],
          subject: "Your off-market request is still being reviewed",
          html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111">
            <p>Hi ${esc(contact.first_name || "there")},</p>
            <p>Your request for off-market access hasn't been approved yet. Michael reviews each one personally, and you'll get an email the moment it's done.</p>
            <p style="color:#666">Michael Loutakis &middot; 0409 438 025</p></div>`,
        });
      }
      return neutral;
    }

    const link = `${siteUrl()}/api/portal/session?t=${createSignInToken(contactId)}`;

    await sendMail({
      to: [email],
      subject: "Sign in to the off-market list",
      html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111">
        <p>Hi ${esc(contact.first_name || "there")},</p>
        <p>Tap below to view what's available. The link works for fifteen minutes.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 28px;font-size:13px;letter-spacing:.12em;text-transform:uppercase">Sign in</a>
        </p>
        <p style="color:#999;font-size:13px">Didn't ask for this? Someone may have entered your details by mistake — you can ignore it, nothing has been shared.</p>
        <p style="color:#666">Michael Loutakis &middot; 0409 438 025</p></div>`,
    });
  } catch (err) {
    console.error("[portal] sign-in failed", err);
  }

  return neutral;
}
