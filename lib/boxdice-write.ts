import "server-only";

/**
 * The ONLY module in this codebase that writes to Box & Dice.
 *
 * The public site is strictly read-only and must stay that way. The off-market
 * portal needs to create contacts, so writes are quarantined here where the
 * rule is visible and enforceable:
 *
 *   - contacts, contact categories, contact notes and enquiries only
 *   - NEVER listings, properties, prices, or anything a person edits in the CRM
 *
 * If you find yourself adding a listing write here, stop: that's the thing we
 * promised the site would never do.
 */

const API_KEY = process.env.BOXDICE_API_KEY;
const API_BASE = (
  process.env.BOXDICE_API_BASE ?? "https://loutakis.boxdice.com.au/website_api"
).replace(/\/$/, "");

function authHeaders() {
  return {
    Authorization: `Api-Key token=${API_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export type NewContact = {
  first_name: string;
  last_name: string;
  email: string;
  mobile?: string;
  /**
   * ALWAYS send these explicitly. Box & Dice defaults both to TRUE for contacts
   * created through the API — verified against the live CRM — which would opt
   * every website registrant into marketing without their consent.
   */
  permit_email_campaign?: boolean;
  permit_sms?: boolean;
};

export type ContactResult = {
  status: number;
  body: unknown;
};

/**
 * Create (or, per the API docs, reuse) a contact.
 *
 * The documentation states an exact match is reused rather than duplicated.
 * That claim is what the dedup test exists to verify — do not rely on it until
 * it has been proven against this account.
 */
export async function createContact(contact: NewContact): Promise<ContactResult> {
  if (!API_KEY) throw new Error("BOXDICE_API_KEY is not set");

  const res = await fetch(`${API_BASE}/contacts`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ contact }),
    cache: "no-store",
  });

  let body: unknown;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 500);
  }

  return { status: res.status, body };
}

/**
 * Record a vendor's marketing approval in the CRM.
 *
 * The Website API has no notes endpoint for LISTINGS — only for contacts. So
 * the record goes on the vendor's contact card (matched by email, created if
 * new), with the property address in the note. That's where anyone in the
 * office will look for it anyway.
 *
 * Marketing flags are sent false explicitly: this contact is a vendor
 * approving their own campaign, not someone opting into a mailing list.
 */
export async function addApprovalNote(
  vendor: { name: string; email: string },
  text: string
): Promise<{ contactId: number | null }> {
  const [first, ...rest] = vendor.name.trim().split(/\s+/);
  const created = await createContact({
    first_name: first || "Vendor",
    last_name: rest.join(" ") || "-",
    email: vendor.email,
    permit_email_campaign: false,
    permit_sms: false,
  });
  const body: any = created.body;
  const contactId = Number(body?.id ?? body?.contact?.id);
  if (!contactId) {
    throw new Error(`approval note: could not resolve vendor contact (${created.status})`);
  }

  const res = await fetch(`${API_BASE}/contacts/${contactId}/notes`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ note: { text }, text }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`approval note -> ${res.status} ${await res.text()}`);
  return { contactId };
}
