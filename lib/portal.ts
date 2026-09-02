import "server-only";
import { createContact } from "./boxdice-write";

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
  suburbs?: string;
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

/** Human-readable summary of the answers, for the CRM timeline. */
function summarise(r: Registration): string {
  const lines = [
    "Registered for the off-market list on the website.",
    `Situation: ${r.situation}`,
    r.budget ? `Budget: ${r.budget}` : null,
    r.suburbs ? `Suburbs: ${r.suburbs}` : null,
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

  return { contactId, consultantId };
}
