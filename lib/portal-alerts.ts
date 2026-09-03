import "server-only";
import { getOffMarketListings } from "./boxdice";
import { getContact, CATEGORY_APPROVED } from "./portal";
import { sendMail, esc } from "./mail";
import { createToken } from "./portal-token";
import {
  listApprovedContacts,
  listOptedOut,
  getAnnouncedListings,
  setAnnouncedListings,
} from "./portal-store";

/**
 * "Something new is on the off-market list" alerts.
 *
 * Deliberately a TEASER: no address, no photo, no price. If the email is
 * forwarded — and some of it will be — nothing about a private campaign
 * escapes. The detail lives behind sign-in, where the confidentiality
 * undertaking applies.
 */

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://loutakis-website.vercel.app").replace(/\/$/, "");
}

export type AlertResult = {
  newListings: number;
  recipients: number;
  skippedOptOut: number;
  skippedNoLongerApproved: number;
  sent: number;
  failed: number;
  dryRun: boolean;
};

/**
 * @param dryRun report what would happen and change nothing — including the
 *   record of what's been announced, so a dry run can't swallow a real alert.
 */
export async function runOffMarketAlerts(dryRun = false): Promise<AlertResult> {
  const result: AlertResult = {
    newListings: 0,
    recipients: 0,
    skippedOptOut: 0,
    skippedNoLongerApproved: 0,
    sent: 0,
    failed: 0,
    dryRun,
  };

  const listings = await getOffMarketListings();
  const currentIds = listings.map((l) => Number(l.id)).filter(Number.isFinite);
  const announced = await getAnnouncedListings();
  const fresh = currentIds.filter((id) => !announced.includes(id));
  result.newListings = fresh.length;

  if (fresh.length === 0) return result;

  const [approved, optedOut] = await Promise.all([listApprovedContacts(), listOptedOut()]);
  result.recipients = approved.length;

  for (const contactId of approved) {
    if (optedOut.includes(contactId)) {
      result.skippedOptOut++;
      continue;
    }

    // Check the CRM, not our list: access may have been revoked by removing the
    // category in Box & Dice, and that must stop the emails too.
    let contact: any;
    try {
      contact = await getContact(contactId);
    } catch (err) {
      console.error(`[alerts] could not read contact ${contactId}`, err);
      result.failed++;
      continue;
    }

    const stillApproved = (contact?.categories ?? []).some(
      (c: any) => String(c?.name ?? "").toLowerCase() === CATEGORY_APPROVED.toLowerCase()
    );
    if (!stillApproved) {
      result.skippedNoLongerApproved++;
      continue;
    }
    if (!contact?.email) {
      result.failed++;
      continue;
    }

    if (dryRun) {
      result.sent++;
      continue;
    }

    try {
      await sendMail({
        to: [contact.email],
        subject:
          fresh.length === 1
            ? "A new off-market property is available"
            : `${fresh.length} new off-market properties are available`,
        html: teaserHtml(contact.first_name, fresh.length, contactId),
      });
      result.sent++;
    } catch (err) {
      console.error(`[alerts] send failed for contact ${contactId}`, err);
      result.failed++;
    }
  }

  if (!dryRun) await setAnnouncedListings([...announced, ...fresh]);
  return result;
}

function teaserHtml(firstName: string | undefined, count: number, contactId: number): string {
  const url = siteUrl();
  // 30-day link. Long enough to survive a holiday, and it only ever unsubscribes.
  const unsub = `${url}/api/portal/unsubscribe?t=${createToken("unsubscribe", contactId, 30)}`;
  const thing = count === 1 ? "a new property" : `${count} new properties`;

  return `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111;line-height:1.55">
      <p>Hi ${esc(firstName || "there")},</p>
      <p>We've added ${thing} to the off-market list.</p>
      <p style="margin:26px 0">
        <a href="${url}/portal" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 28px;font-size:13px;letter-spacing:.12em;text-transform:uppercase">See what's available</a>
      </p>
      <p style="color:#666">
        You'll need to sign in — we keep the detail off email so nothing about a
        private campaign travels further than it should.
      </p>
      <p style="color:#666">Michael Loutakis &middot; 0409 438 025</p>
      <p style="margin-top:30px;color:#999;font-size:12px;border-top:1px solid #eee;padding-top:16px">
        You're getting this because you asked to be on the Loutakis off-market list.
        <a href="${unsub}" style="color:#999">Stop these emails</a> — you'll keep your access to the list itself.
      </p>
    </div>
  `;
}
