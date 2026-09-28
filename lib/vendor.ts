import "server-only";
import { sendMail, officeRecipients, withAdmin, esc } from "./mail";
import { createToken } from "./portal-token";
import {
  updateCampaign,
  campaignVendors,
  vendorEmails,
  vendorGreeting,
  outstandingVendors,
  mode,
  type Campaign,
  type Approval,
  type Vendor,
} from "./campaigns";
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

/**
 * ONE LINK PER VENDOR, not one link for the property.
 *
 * The token carries which of them it was sent to, so an approval is
 * attributable to the person we emailed rather than to whatever name was typed
 * into the box. That is the difference between a record and a claim, and on a
 * two-owner title it is the whole point: without it, one person at a kitchen
 * table can sign for both and nothing would ever show it.
 *
 * 60 days — long enough to survive a holiday, and it only reaches one property.
 */
export function vendorLink(campaignId: string, vendorIndex: number): string {
  const t = createToken("vendor", `${campaignId}:${vendorIndex}`, 60);
  return `${siteUrl()}/approve/${campaignId}?t=${t}`;
}

/**
 * Which vendor a link belongs to, or null if it isn't a link for this campaign.
 *
 * LINKS SENT BEFORE PER-VENDOR TOKENS carry the campaign id with no index.
 * Those are read as the first vendor rather than rejected: a vendor holding one
 * has done nothing wrong, and an expired-link page would be a phone call and a
 * lost afternoon. They stop appearing as soon as the campaign is re-sent.
 */
export function vendorFromToken(
  c: Campaign,
  payloadC: string
): { index: number; vendor: Vendor } | null {
  const [id, raw] = String(payloadC).split(":");
  if (id !== c.id) return null;
  const people = campaignVendors(c);
  if (!people.length) return null;
  const index = raw === undefined ? 0 : Number(raw);
  if (!Number.isInteger(index) || index < 0 || index >= people.length) return null;
  return { index, vendor: people[index] };
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

/**
 * Each vendor gets their OWN email with their OWN link.
 *
 * It used to be one message to all of them carrying one shared link. That was
 * fine while any single approval was enough; it cannot work now, because a
 * shared link cannot tell us which owner pressed the button.
 *
 * Sent one at a time rather than in parallel: if the second address bounces we
 * still want the first to have arrived, and the error to name who missed out.
 */
export async function sendVendorLink(c: Campaign, sentBy: string): Promise<void> {
  const people = campaignVendors(c);
  const both = people.length > 1 && mode(c) === "all";

  for (const [i, v] of people.entries()) {
    const others = people.filter((_, n) => n !== i).map((x) => x.name.split(" ")[0] || "the other owner");
    await sendMail({
      to: [v.email],
      subject: `Your marketing for ${c.address} is ready to review`,
      html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111;line-height:1.55">
        <p>Hi ${esc(v.name.split(" ")[0] || "there")},</p>
        <p>The marketing for <strong>${esc(c.address)}</strong> is ready for you to look over — the board, brochure, copy, floorplan, photos and video, all in one place.</p>
        <p style="margin:26px 0">
          <a href="${vendorLink(c.id, i)}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 28px;font-size:13px;letter-spacing:.12em;text-transform:uppercase">Review and approve</a>
        </p>
        ${
          both
            ? `<p style="color:#666">${esc(others.join(" and "))} ${others.length > 1 ? "have" : "has"} been sent the same thing separately. We need both of you before anything goes to print, so this link is yours — please don't forward it.</p>`
            : ""
        }
        <p style="color:#666">Take a minute with it — the way we tell your story online makes all the difference. If anything needs changing, there's a box for that on the page.</p>
      </div>
    `,
      replyTo: { address: sentBy, name: "Loutakis Real Estate" },
    });
  }
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
 * One vendor putting their name to it.
 *
 * ONE SIGNATURE IS NOT NECESSARILY THE APPROVAL. On a two-owner title with the
 * mode set to "all", this records Anna and then waits — nothing is written to
 * the CRM, nothing is produced, and Peter gets told it is his turn. Only the
 * signature that completes the set finalises the campaign.
 *
 * That distinction is the entire point: marketing costs money the moment it is
 * approved, and an authorisation given by one of two owners does not cover it.
 *
 * Returns what happened so the page can say the right thing.
 */
export async function approveCampaign(
  c: Campaign,
  vendor: Vendor,
  name: string,
  meta: { ip: string; userAgent: string }
): Promise<{ complete: boolean; waitingOn: Vendor[] }> {
  const at = new Date().toISOString();

  // Re-signing replaces rather than stacks: the same person pressing twice is
  // one approval, and the later name is the one they meant.
  const approvals: Approval[] = [
    ...(c.approvals ?? []).filter(
      (a) => a.email.toLowerCase() !== vendor.email.trim().toLowerCase()
    ),
    { email: vendor.email.trim().toLowerCase(), name, at, ip: meta.ip },
  ];

  const after: Campaign = { ...c, approvals };
  const waitingOn = outstandingVendors(after);

  if (waitingOn.length) {
    await updateCampaign(c.id, { approvals, status: "partial" });
    await notifyPartial(after, vendor, name, waitingOn).catch((err) =>
      console.error("[vendor] partial notify failed", err)
    );
    return { complete: false, waitingOn };
  }

  await finaliseApproval(after, name, at, meta);
  return { complete: true, waitingOn: [] };
}

/**
 * Everyone has signed. The order matters: write the CRM note FIRST so the
 * authoritative record exists before anything else can fail, then the receipt,
 * then the office, then our own status.
 */
async function finaliseApproval(
  c: Campaign,
  name: string,
  at: string,
  meta: { ip: string; userAgent: string }
): Promise<void> {
  const signed = c.approvals ?? [];

  const note = [
    `MARKETING APPROVED — ${c.address} (listing ${c.listingId}) — ${fmt(at)}`,
    mode(c) === "all" && campaignVendors(c).length > 1
      ? `Approved by ALL ${campaignVendors(c).length} owners:`
      : `Approved by:`,
    ...signed.map((a) => `- ${a.name} <${a.email}> on ${fmt(a.at)} from ${a.ip}`),
    ``,
    `Sent to: ${campaignVendors(c).map((v) => `${v.name} <${v.email}>`).join("; ") || "—"}`,
    `Sent by: ${c.sentBy ?? c.createdBy} on ${c.sentAt ? fmt(c.sentAt) : "—"}`,
    `Link opened ${c.openCount} time(s)`,
    ``,
    `Authorisation agreed to by each of the above:`,
    AUTHORISATION_WORDING,
    ``,
    ...(c.amendments.length ? [`Notes from the vendor:`, ...c.amendments.map((a) => `- ${a.name}: ${a.text}`), ``] : []),
    `Approved copy (heading: ${c.copyHeading || "—"}):`,
    c.selection.includeCopy ? c.copyText : "(copy not part of this approval)",
  ].join("\n");

  // The note lands on the contact card of whoever approved, matched on the
  // address it was sent to — falling back to the first vendor when the
  // approver's own address isn't one we hold.
  await addApprovalNote({ name, email: vendorEmails(c)[0] ?? "" }, note);

  // Receipt to everyone who signed — they each keep what they agreed to.
  await sendMail({
    to: vendorEmails(c),
    subject: `Marketing approved — ${c.address}`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111;line-height:1.55">
        <p>Hi ${esc(vendorGreeting(c))},</p>
        <p>Thank you — the marketing for <strong>${esc(c.address)}</strong> is approved and production is under way.</p>
        <p style="color:#666">Signed by ${esc(signed.map((a) => a.name).join(" and "))}${signed.length > 1 ? ", both owners" : ""}.</p>
        <p style="margin:22px 0;padding:16px 18px;background:#f4f4f4;color:#444;font-size:14px;line-height:1.5">${esc(AUTHORISATION_WORDING)}</p>
        <p style="color:#666">This is your copy of the approval. Any questions, call Michael on 0409 438 025.</p>
      </div>
    `,
  }).catch((err) => console.error("[vendor] receipt failed", err));

  // The office, immediately.
  await sendMail({
    to: withAdmin(officeRecipients()),
    subject: `APPROVED — ${c.address}`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111;line-height:1.55">
        <p>The marketing for <strong>${esc(c.address)}</strong> is fully approved at ${esc(fmt(at))}.</p>
        <ul style="color:#444">${signed.map((a) => `<li>${esc(a.name)} &lt;${esc(a.email)}&gt; — ${esc(fmt(a.at))}</li>`).join("")}</ul>
        <p>The note is on the contact card in Box &amp; Dice, with the approved copy.</p>
        <p><a href="${siteUrl()}/staff/${c.id}">Open the campaign</a></p>
      </div>
    `,
  }).catch((err) => console.error("[vendor] office notify failed", err));

  await updateCampaign(c.id, {
    status: "approved",
    approvedAt: at,
    approvedName: signed.map((a) => a.name).join(" and "),
    approvals: signed,
    amendments: c.amendments,
  });
}

/**
 * One down, one to go. Tells THE OFFICE and nobody else.
 *
 * NO AUTOMATIC NUDGE TO THE OTHER OWNER. It is tempting — a campaign stalled on
 * a second signature looks like progress and is easy to forget — but an email
 * saying "your co-owner has approved, now you" arrives as pressure from us at
 * a moment that is theirs to work out between themselves. Whether that chase
 * happens, and whether it is a call rather than an email, is the agent's
 * judgement. The office is told so it can be made.
 */
async function notifyPartial(
  c: Campaign,
  signer: Vendor,
  name: string,
  waitingOn: Vendor[]
): Promise<void> {
  const total = campaignVendors(c).length;
  const done = (c.approvals ?? []).length;

  await sendMail({
    to: withAdmin(officeRecipients()),
    subject: `${done} of ${total} approved — ${c.address}`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111;line-height:1.55">
        <p><strong>${esc(name)}</strong> approved the marketing for <strong>${esc(c.address)}</strong>.</p>
        <p style="color:#b45309"><strong>Not yet approved</strong> — still waiting on ${esc(waitingOn.map((v) => v.name || v.email).join(" and "))}. Nothing goes to production until they sign.</p>
        <p style="color:#666">They have not been chased automatically. Their link still works — re-send it from the campaign page, or ring them.</p>
        <p><a href="${siteUrl()}/staff/${c.id}">Open the campaign</a></p>
      </div>
    `,
    replyTo: signer.email ? { address: signer.email, name: signer.name } : undefined,
  });
}

/**
 * Changes requested. Notify the office; record it; no CRM note — nothing is
 * final yet.
 *
 * EVERY APPROVAL ALREADY GIVEN IS CLEARED. If Anna signed off and Peter then
 * asked for the price guide to change, what gets produced is not what Anna
 * approved, so her approval no longer covers it. Making her sign again is the
 * point rather than the cost — and it is the version of this we would want to
 * be able to explain later.
 */
export async function requestChanges(c: Campaign, name: string, text: string): Promise<void> {
  const at = new Date().toISOString();
  const amendments = [...(c.amendments ?? []), { at, name, text }];
  const cleared = (c.approvals ?? []).length;

  await sendMail({
    to: withAdmin(officeRecipients()),
    subject: `CHANGES REQUESTED — ${c.address}`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111;line-height:1.55">
        <p><strong>${esc(name)}</strong> has asked for changes to the marketing for <strong>${esc(c.address)}</strong>:</p>
        <blockquote style="margin:18px 0;padding:14px 18px;border-left:3px solid #b45309;background:#fafafa;white-space:pre-wrap">${esc(text)}</blockquote>
        ${cleared ? `<p style="color:#b45309"><strong>${cleared} approval${cleared === 1 ? "" : "s"} already given ${cleared === 1 ? "has" : "have"} been cleared.</strong> What gets produced is no longer what they signed off, so everyone approves again once the change is made.</p>` : ""}
        <p>Make the changes in Box &amp; Dice or SharePoint, then re-send from the campaign page — they'll see the updated version at the same link.</p>
        <p><a href="${siteUrl()}/staff/${c.id}">Open the campaign</a></p>
      </div>
    `,
    replyTo: (() => {
      const v = campaignVendors(c)[0];
      return v?.email ? { address: v.email, name: v.name } : undefined;
    })(),
  });

  await updateCampaign(c.id, { status: "changes", amendments, approvals: [] });
}
