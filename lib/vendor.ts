import "server-only";
import { sendMail, officeRecipients, esc } from "./mail";
import { createToken } from "./portal-token";
import { updateCampaign, type Campaign } from "./campaigns";
import { addApprovalNote } from "./boxdice-write";

/**
 * The vendor's side of marketing approval: the link they receive, what
 * happens when they open it, and what approving or asking for changes does.
 */

/**
 * The authorisation the vendor agrees to. VERBATIM from the Squarespace page
 * Michael wrote — not to be tidied here. Held in one place so the page, the
 * CRM note and the receipt all quote exactly the same words.
 */
export const AUTHORISATION_WORDING =
  "By submitting this form, I confirm that I am authorised to approve marketing for this property " +
  "and have reviewed all materials provided. I authorise Loutakis Real Estate to proceed with " +
  "marketing production and bookings, understanding that costs may be incurred immediately and " +
  "approval cannot be withdrawn once production has commenced.";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://loutakis-website.vercel.app").replace(/\/$/, "");
}

/** The link works for 60 days: long enough to survive a holiday, and it only reaches one property. */
export function vendorLink(campaignId: string): string {
  return `${siteUrl()}/approve/${campaignId}?t=${createToken("vendor", campaignId, 60)}`;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  });

const first = (name: string) => name.trim().split(/\s+/)[0] || "there";

export async function sendVendorLink(c: Campaign, sentBy: string): Promise<void> {
  await sendMail({
    to: [c.vendorEmail],
    subject: `Your marketing for ${c.address} is ready to review`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111;line-height:1.55">
        <p>Hi ${esc(first(c.vendorName))},</p>
        <p>The marketing for <strong>${esc(c.address)}</strong> is ready for you to look over — the board, brochure, copy, floorplan, photos and video, all in one place.</p>
        <p style="margin:26px 0">
          <a href="${vendorLink(c.id)}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 28px;font-size:13px;letter-spacing:.12em;text-transform:uppercase">Review and approve</a>
        </p>
        <p style="color:#666">Take a minute with it — the way we tell your story online makes all the difference. If anything needs changing, there's a box for that on the page.</p>
        <p style="color:#666">Michael Loutakis &middot; 0409 438 025</p>
      </div>
    `,
    replyTo: { address: sentBy, name: "Loutakis Real Estate" },
  });
}

/** Called every time the vendor page renders with a valid link. */
export async function recordOpen(c: Campaign): Promise<void> {
  const patch: Partial<Campaign> = {
    openCount: (c.openCount ?? 0) + 1,
    openedAt: new Date().toISOString(),
  };
  // Only a 'sent' campaign becomes 'opened'; never regress approved/changes.
  if (c.status === "sent") patch.status = "opened";
  await updateCampaign(c.id, patch).catch((err) => console.error("[vendor] open record failed", err));
}

/**
 * Approval. The order matters: write the CRM note FIRST so the authoritative
 * record exists before anything else can fail, then the receipt, then the
 * office, then our own status.
 */
export async function approveCampaign(
  c: Campaign,
  name: string,
  meta: { ip: string; userAgent: string }
): Promise<void> {
  const at = new Date().toISOString();

  const note = [
    `MARKETING APPROVED — ${c.address} (listing ${c.listingId}) — ${fmt(at)}`,
    `Approved by: ${name} (${c.vendorEmail})`,
    `Sent by: ${c.sentBy ?? c.createdBy} on ${c.sentAt ? fmt(c.sentAt) : "—"}`,
    `Link opened ${c.openCount} time(s); approved from ${meta.ip}`,
    ``,
    `Authorisation agreed to:`,
    AUTHORISATION_WORDING,
    ``,
    ...(c.amendments.length ? [`Notes from the vendor:`, ...c.amendments.map((a) => `- ${a.name}: ${a.text}`), ``] : []),
    `Approved copy (heading: ${c.copyHeading || "—"}):`,
    c.selection.includeCopy ? c.copyText : "(copy not part of this approval)",
  ].join("\n");

  await addApprovalNote({ name, email: c.vendorEmail }, note);

  // Receipt to the vendor — they keep what they agreed to.
  await sendMail({
    to: [c.vendorEmail],
    subject: `Marketing approved — ${c.address}`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111;line-height:1.55">
        <p>Hi ${esc(first(c.vendorName))},</p>
        <p>Thank you — the marketing for <strong>${esc(c.address)}</strong> was approved by <strong>${esc(name)}</strong> on ${esc(fmt(at))}. Production is under way.</p>
        <p style="margin:22px 0;padding:16px 18px;background:#f4f4f4;color:#444;font-size:14px;line-height:1.5">${esc(AUTHORISATION_WORDING)}</p>
        <p style="color:#666">This is your copy of the approval. Any questions, call Michael on 0409 438 025.</p>
      </div>
    `,
  }).catch((err) => console.error("[vendor] receipt failed", err));

  // The office, immediately.
  await sendMail({
    to: officeRecipients(),
    subject: `APPROVED — ${c.address}`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111;line-height:1.55">
        <p><strong>${esc(name)}</strong> approved the marketing for <strong>${esc(c.address)}</strong> at ${esc(fmt(at))}.</p>
        <p>The note is on ${esc(name)}'s contact card in Box &amp; Dice, with the approved copy.</p>
        <p><a href="${siteUrl()}/staff/${c.id}">Open the campaign</a></p>
      </div>
    `,
  }).catch((err) => console.error("[vendor] office notify failed", err));

  await updateCampaign(c.id, { status: "approved", approvedAt: at, approvedName: name, amendments: c.amendments });
}

/** Changes requested. Notify the office; record it; no CRM note — nothing is final yet. */
export async function requestChanges(c: Campaign, name: string, text: string): Promise<void> {
  const at = new Date().toISOString();
  const amendments = [...(c.amendments ?? []), { at, name, text }];

  await sendMail({
    to: officeRecipients(),
    subject: `CHANGES REQUESTED — ${c.address}`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111;line-height:1.55">
        <p><strong>${esc(name)}</strong> has asked for changes to the marketing for <strong>${esc(c.address)}</strong>:</p>
        <blockquote style="margin:18px 0;padding:14px 18px;border-left:3px solid #b45309;background:#fafafa;white-space:pre-wrap">${esc(text)}</blockquote>
        <p>Make the changes in Box &amp; Dice or SharePoint, then re-send from the campaign page — they'll see the updated version at the same link.</p>
        <p><a href="${siteUrl()}/staff/${c.id}">Open the campaign</a></p>
      </div>
    `,
    replyTo: { address: c.vendorEmail, name: c.vendorName },
  });

  await updateCampaign(c.id, { status: "changes", amendments });
}
