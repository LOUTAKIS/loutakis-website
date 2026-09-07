import { NextResponse } from "next/server";
import {
  lookupContactId,
  storeConfigured,
  shouldSendNotRegistered,
  getRegisteredEmail,
  saveSignInCode,
} from "@/lib/portal-store";
import { randomBytes, randomInt } from "node:crypto";
import { cookies } from "next/headers";
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

  /**
   * The browser that asked for the code. The code only works here, so an email
   * that is forwarded (or read on a shared screen) is of no use to anyone else
   * — they would need the link itself, which lands in the same inbox.
   */
  const jar = cookies();
  let device = jar.get("lre_dev")?.value ?? "";
  if (!/^[a-f0-9]{32}$/.test(device)) {
    device = randomBytes(16).toString("hex");
    neutral.cookies.set("lre_dev", device, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  if (!storeConfigured().read) {
    console.error("[portal] sign-in requested but the store isn't configured");
    return neutral;
  }

  /**
   * Nobody should be left wondering. If the identifier isn't on the list we
   * write to that address with the way in — never revealing on screen whether
   * it was known, and never more than once a day per address, so the form
   * can't be turned into a mail cannon.
   */
  const looksLikeEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identifier);
  const inviteToRegister = async () => {
    if (!looksLikeEmail) return; // a mobile number gives us nowhere to write
    if (!(await shouldSendNotRegistered(identifier))) return;
    await sendMail({
      to: [identifier],
      subject: "Off-market access — you're not on the list yet",
      html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111;line-height:1.55">
        <p>Hi,</p>
        <p>Someone (we hope you) asked for a sign-in link to our off-market list using this address. There's no registration against it yet.</p>
        <p>Request access here — it takes a minute, and Michael reviews each one personally:</p>
        <p style="margin:24px 0">
          <a href="${siteUrl()}/portal/register" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 28px;font-size:13px;letter-spacing:.12em;text-transform:uppercase">Request access</a>
        </p>
        <p style="color:#999;font-size:13px">If this wasn't you, ignore this email — nothing has been created or shared.</p></div>`,
    });
  };

  try {
    const contactId = await lookupContactId(identifier);
    if (!contactId) {
      await inviteToRegister();
      return neutral;
    }

    const contact = await getContact(contactId);
    /**
     * Only ever an address the person gave us: the one they registered with,
     * or — when they signed in with an email — that exact address, which only
     * matched because it is already on their record. The CRM's own primary is
     * never used; it may be an old address on a contact matched by name.
     */
    const registered = await getRegisteredEmail(contactId).catch(() => null);
    const email = String(registered || (looksLikeEmail ? identifier : "")).trim();
    if (!email) {
      console.error(`[portal] contact ${contactId} has no registered email — nothing sent`);
      return neutral;
    }

    const names = (contact?.categories ?? []).map((c: any) => String(c?.name ?? c));
    const approved = names.includes(CATEGORY_APPROVED);
    const pending = names.includes(CATEGORY_PENDING);

    if (!approved) {
      // Tell them where they stand — but only via the email on file, which is
      // the same proof-of-inbox the sign-in link relies on.
      if (!pending) {
        // On the CRM but never registered for off-market: point them at the form.
        await inviteToRegister();
      }
      if (pending) {
        await sendMail({
          to: [email],
          subject: "Your off-market request is still being reviewed",
          html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111">
            <p>Hi ${esc(contact.first_name || "there")},</p>
            <p>Your request for off-market access hasn't been approved yet. Michael reviews each one personally, and you'll get an email the moment it's done.</p></div>`,
        });
      }
      return neutral;
    }

    const link = `${siteUrl()}/api/portal/session?t=${createSignInToken(contactId)}`;

    // Six digits for whoever is reading this on a phone with the site open on
    // another screen. Same fifteen minutes as the link, single use.
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await saveSignInCode({
      contactId: Number(contactId),
      code,
      device,
      expires: Date.now() + 15 * 60_000,
      tries: 0,
    }).catch((err) => console.error("[portal] code save failed", err));

    await sendMail({
      to: [email],
      subject: `${code} is your sign-in code`,
      html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111;line-height:1.55">
        <p>Hi ${esc(contact.first_name || "there")},</p>
        <p>Enter this code on the sign-in page:</p>
        <p style="margin:22px 0;font-size:34px;letter-spacing:.28em;font-weight:600">${code}</p>
        <p>Or, if you're reading this on the device you want to browse on:</p>
        <p style="margin:22px 0">
          <a href="${link}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 28px;font-size:13px;letter-spacing:.12em;text-transform:uppercase">Sign in</a>
        </p>
        <p style="color:#666;font-size:13px">Both work for fifteen minutes, once.</p>
        <p style="color:#999;font-size:13px">Didn't ask for this? Someone may have entered your details by mistake — you can ignore it, nothing has been shared.</p></div>`,
    });
  } catch (err) {
    console.error("[portal] sign-in failed", err);
  }

  return neutral;
}
