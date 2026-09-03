import "server-only";
import { createContact } from "./boxdice-write";
import { sendMail, officeRecipients, esc } from "./mail";
import { createToken } from "./portal-token";
import {
  rememberContact,
  rememberCriteria,
  takeCriteria,
  addApprovedContact,
  removeApprovedContact,
} from "./portal-store";
import { namesForIds } from "./suburbs";

/**
 * Off-market portal — Box & Dice operations.
 *
 * Everything the portal knows lives in the CRM: the buyer is a contact, and
 * their approval state is a contact category. No second database.
 *
 * Paths and payloads below were established by testing against the live API,
 * not read off the documentation — see scripts/bd-*.mjs.
 */

const API_KEY = process.env.BOXDICE_API_KEY;
const API_BASE = (
  process.env.BOXDICE_API_BASE ?? "https://loutakis.boxdice.com.au/website_api"
).replace(/\/$/, "");

export const CATEGORY_PENDING = "Off Market List - Pending";
export const CATEGORY_APPROVED = "Off Market List";

function authHeaders() {
  return {
    Authorization: `Api-Key token=${API_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export type Registration = {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  situation: string;
  budget?: string;
  /** Box & Dice suburb ids, already validated against lib/suburbs-vic.json. */
  suburbIds?: number[];
  beds?: string;
  timeframe?: string;
  /** Explicitly ticked. Never assumed — see the consent note below. */
  marketingConsent: boolean;
};

/** Read a contact back. Also the only way to learn its consultant_id. */
export async function getContact(contactId: number | string): Promise<any> {
  const res = await fetch(`${API_BASE}/contacts/${contactId}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`getContact ${contactId} -> ${res.status}`);
  const json = await res.json();
  return json?.contact ?? json;
}

/**
 * Assign a contact category.
 *
 * Categories are held per consultant, so consultant_id is REQUIRED — without it
 * the API answers 404 "Couldn't find Consultant without an ID". Sending an
 * array of plain strings returns 201 and silently does nothing, so always
 * verify by reading the contact back rather than trusting the status code.
 * type_id is resolved by the API from the name.
 */
export async function assignCategory(
  contactId: number | string,
  category: string,
  consultantId: number
) {
  const res = await fetch(`${API_BASE}/contacts/${contactId}/categories`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ categories: [{ name: category, consultant_id: consultantId }] }),
    cache: "no-store",
  });

  if (res.ok) return;

  // A repeat registration answers 422 because the category is already there.
  // Status codes have been unreliable on this API in both directions, so the
  // only thing worth trusting is the record itself.
  const detail = await res.text();
  const stored = await getContact(contactId).catch(() => null);
  const present = (stored?.categories ?? []).some((c: any) => (c?.name ?? c) === category);

  if (present) return; // already assigned — nothing to do, not an error

  throw new Error(`assignCategory ${category} -> ${res.status} ${detail}`);
}

/**
 * Write the registration answers to the contact's timeline.
 *
 * The exact path isn't documented, so two candidates are tried. This must never
 * break a registration — if the note fails the buyer is still registered, and
 * we log loudly instead.
 */
export async function addNote(contactId: number | string, text: string) {
  try {
    const res = await fetch(`${API_BASE}/contacts/${contactId}/notes`, {
      method: "POST",
      headers: authHeaders(),
      // Both keys: the endpoint accepted this shape in testing, and it isn't
      // documented which one it reads.
      body: JSON.stringify({ note: { text }, text }),
      cache: "no-store",
    });
    if (res.ok) return { ok: true };
    console.error(`[portal] note write -> ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error("[portal] note write failed", err);
  }
  // Never fail a registration because a timeline note didn't stick.
  return { ok: false };
}

/**
 * The form's budget bands, as CRM price bounds. Deliberately a lookup rather
 * than parsing the label: the labels are display copy and will get reworded,
 * and a regex quietly returning nothing would be worse than a missing entry.
 */
const BUDGET_BOUNDS: Record<string, { from?: number; to?: number }> = {
  "Under $600,000": { to: 600_000 },
  "$600,000 – $800,000": { from: 600_000, to: 800_000 },
  "$800,000 – $1m": { from: 800_000, to: 1_000_000 },
  "$1m – $1.5m": { from: 1_000_000, to: 1_500_000 },
  "$1.5m – $2m": { from: 1_500_000, to: 2_000_000 },
  "Over $2m": { from: 2_000_000 },
};

/**
 * Write real buying criteria, so the buyer turns up in CRM searches — a
 * timeline note doesn't. Never fatal: someone approved with no criteria is a
 * smaller problem than an approval that failed halfway.
 */
export async function createCriteria(
  contactId: number | string,
  c: {
    suburbIds?: number[];
    budget?: string;
    beds?: string;
    timeframe?: string;
    situation?: string;
  }
): Promise<void> {
  const bounds = c.budget ? BUDGET_BOUNDS[c.budget] : undefined;
  // "5+" means five or more, so it's a floor, not an exact count.
  const beds = c.beds ? Number(String(c.beds).replace("+", "")) : undefined;

  const criteria: Record<string, unknown> = { type: "sales" };
  if (c.suburbIds?.length) criteria.suburb_ids = c.suburbIds;
  if (Number.isFinite(beds) && beds) criteria.beds_from = beds;
  if (bounds?.from) criteria.price_from = String(bounds.from);
  if (bounds?.to) criteria.price_to = String(bounds.to);

  // Timeframe and situation have no field of their own in the criteria schema,
  // and they're exactly what you want to see when the search result comes up.
  const notes = [
    c.situation ? `Situation: ${c.situation}` : null,
    c.timeframe ? `Timeframe: ${c.timeframe}` : null,
    "Source: website off-market registration",
  ].filter(Boolean);
  criteria.notes = notes.join(" · ");

  // Only the marker fields would be sent if the buyer skipped every optional
  // question — an empty criteria record is clutter, so don't create one.
  const hasSubstance =
    criteria.suburb_ids || criteria.beds_from || criteria.price_from || criteria.price_to;
  if (!hasSubstance) return;

  try {
    const res = await fetch(`${API_BASE}/contacts/${contactId}/criteria`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ criteria }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[portal] criteria write -> ${res.status} ${await res.text()}`);
      return;
    }
    console.log(`[portal] criteria created for contact ${contactId}`, criteria);
  } catch (err) {
    console.error("[portal] criteria write failed", err);
  }
}

/** Human-readable summary of the answers, for the CRM timeline. */
function summarise(r: Registration): string {
  const lines = [
    "Registered for the off-market list on the website.",
    `Situation: ${r.situation}`,
    r.budget ? `Budget: ${r.budget}` : null,
    r.suburbIds?.length ? `Suburbs: ${namesForIds(r.suburbIds).join(", ")}` : null,
    r.beds ? `Minimum bedrooms: ${r.beds}` : null,
    r.timeframe ? `Timeframe: ${r.timeframe}` : null,
    `Marketing consent: ${r.marketingConsent ? "YES — ticked on the form" : "no"}`,
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Register a buyer: create (or match) the contact, mark them pending, and put
 * their answers on the timeline.
 *
 * CONSENT: Box & Dice defaults permit_email_campaign and permit_sms to TRUE for
 * contacts created through the API. That would opt every registrant into
 * marketing without asking, which the Spam Act does not allow. Both flags are
 * therefore sent EXPLICITLY on every write. Do not remove them.
 */
export async function registerBuyer(r: Registration) {
  const contact = {
    first_name: r.firstName,
    last_name: r.lastName,
    email: r.email,
    mobile: r.mobile,
    permit_email_campaign: r.marketingConsent,
    permit_sms: r.marketingConsent,
  };

  const created = await createContact(contact);
  if (created.status >= 400) {
    throw new Error(`createContact -> ${created.status} ${JSON.stringify(created.body)}`);
  }

  const body: any = created.body;
  const contactId = body?.id ?? body?.contact?.id;
  if (!contactId) {
    throw new Error(`createContact returned no id: ${JSON.stringify(body)}`);
  }

  // The contact's own consultant owns its categories, so read it back rather
  // than assuming — a matched existing contact may belong to a different agent.
  const stored = await getContact(contactId);
  const consultantId = Number(stored?.consultant_id);
  if (!consultantId) {
    throw new Error(`contact ${contactId} has no consultant_id; cannot assign category`);
  }

  await assignCategory(contactId, CATEGORY_PENDING, consultantId);
  await addNote(contactId, summarise(r));

  // So they can sign in later by email or mobile. Recorded at registration,
  // not approval, so a pending buyer who tries to sign in can be told they're
  // pending rather than "unknown".
  await rememberContact({ contactId, email: r.email, mobile: r.mobile }).catch((err) =>
    console.error("[portal] store write failed", err)
  );

  // Their answers, held until approval — criteria are only written into the CRM
  // for buyers you've actually approved, so declined requests never pollute
  // your searches.
  await rememberCriteria(contactId, {
    suburbIds: r.suburbIds,
    budget: r.budget,
    beds: r.beds,
    timeframe: r.timeframe,
    situation: r.situation,
  }).catch((err) => console.error("[portal] criteria stash failed", err));

  // Tell the office. A registration nobody hears about is a lead lost — this
  // must not depend on anyone remembering to look in the CRM.
  await notifyOffice(contactId, r).catch((err) =>
    console.error("[portal] registration notification failed", err)
  );

  return { contactId, consultantId };
}

const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? "https://loutakis-website.vercel.app").replace(/\/$/, "");

/** Email the office with the registration and one-tap approve / decline links. */
export async function notifyOffice(contactId: number | string, r: Registration) {
  const approve = `${siteUrl()}/api/portal/approve?t=${createToken("approve", contactId)}`;
  const decline = `${siteUrl()}/api/portal/approve?t=${createToken("decline", contactId)}`;

  const rows: Array<[string, string]> = [
    ["Name", `${r.firstName} ${r.lastName}`],
    ["Mobile", r.mobile],
    ["Email", r.email],
    ["Situation", r.situation],
    ["Budget", r.budget || "—"],
    ["Suburbs", r.suburbIds?.length ? namesForIds(r.suburbIds).join(", ") : "—"],
    ["Min bedrooms", r.beds || "—"],
    ["Timeframe", r.timeframe || "—"],
    ["Marketing consent", r.marketingConsent ? "Yes" : "No"],
  ];

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111">
      <p style="margin:0 0 4px"><strong>Off-market access request</strong></p>
      <p style="margin:0 0 20px;color:#666">They can't see anything until you approve.</p>

      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:26px">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:4px 18px 4px 0;color:#666;vertical-align:top">${esc(k)}</td>` +
              `<td style="padding:4px 0">${esc(v)}</td></tr>`
          )
          .join("")}
      </table>

      <table cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:12px">
          <a href="${approve}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 28px;font-size:13px;letter-spacing:.12em;text-transform:uppercase">Approve access</a>
        </td>
        <td>
          <a href="${decline}" style="display:inline-block;border:1px solid #ccc;color:#666;text-decoration:none;padding:13px 26px;font-size:13px;letter-spacing:.12em;text-transform:uppercase">Decline</a>
        </td>
      </tr></table>

      <p style="margin:24px 0 0;color:#999;font-size:13px">
        One tap, no login needed. Links work for 30 days.<br>
        Reply to this email to answer ${esc(r.firstName)} directly.
      </p>
    </div>
  `;

  await sendMail({
    to: officeRecipients(),
    subject: `Off-market access request — ${r.firstName} ${r.lastName}`,
    html,
    replyTo: { address: r.email, name: `${r.firstName} ${r.lastName}` },
  });
}

/** Move a contact from pending to approved, and tell them. */
export async function approveBuyer(contactId: string) {
  const contact = await getContact(contactId);
  const consultantId = Number(contact?.consultant_id);
  if (!consultantId) throw new Error(`contact ${contactId} has no consultant_id`);

  const name = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || "there";

  await assignCategory(contactId, CATEGORY_APPROVED, consultantId);
  await removeCategory(contactId, CATEGORY_PENDING, consultantId);
  await addNote(contactId, "Approved for the off-market list via the website.");

  // Now that they're a real buyer, record what they're after as searchable
  // criteria. takeCriteria clears the stash, so re-approving won't duplicate.
  const pending = await takeCriteria(contactId).catch(() => null);
  if (pending) await createCriteria(contactId, pending);

  // Add them to the new-listing alert list. Membership is still checked against
  // the CRM category at send time, so revoking access there stops the emails.
  await addApprovedContact(contactId).catch((err) =>
    console.error("[portal] alert list add failed", err)
  );

  if (contact?.email) {
    await sendMail({
      to: [contact.email],
      subject: "Your off-market access is open",
      html: `
        <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111">
          <p>Hi ${esc(contact.first_name || "there")},</p>
          <p>You're approved for the Loutakis off-market list. You can see what's available here:</p>
          <p style="margin:24px 0">
            <a href="${siteUrl()}/portal" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 28px;font-size:13px;letter-spacing:.12em;text-transform:uppercase">View properties</a>
          </p>
          <p style="color:#666">These aren't publicly advertised, so please keep them to yourself — that's the basis on which the owners agreed to be listed.</p>
          <p style="color:#666">Michael Loutakis &middot; 0409 438 025</p>
        </div>`,
    }).catch((err) => console.error("[portal] approval email failed", err));
  }

  return { name, email: contact?.email ?? null };
}

/** Decline: clear the pending marker and note it. No email — a silent no. */
export async function declineBuyer(contactId: string) {
  const contact = await getContact(contactId);
  const consultantId = Number(contact?.consultant_id);
  const name = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || "that person";

  if (consultantId) await removeCategory(contactId, CATEGORY_PENDING, consultantId);
  await addNote(contactId, "Off-market access request declined via the website.");

  // Declined people were never on the alert list, but a previously approved
  // buyer might be declined later — make sure the emails stop either way.
  await removeApprovedContact(contactId).catch(() => {});

  return { name };
}

/** Best effort — leaving a stale pending marker is untidy, not harmful. */
export async function removeCategory(
  contactId: number | string,
  category: string,
  consultantId: number
) {
  try {
    const res = await fetch(`${API_BASE}/contacts/${contactId}/categories`, {
      method: "DELETE",
      headers: authHeaders(),
      body: JSON.stringify({ categories: [{ name: category, consultant_id: consultantId }] }),
      cache: "no-store",
    });
    if (!res.ok) console.error(`[portal] removeCategory ${category} -> ${res.status}`);
  } catch (err) {
    console.error("[portal] removeCategory failed", err);
  }
}
