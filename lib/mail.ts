import "server-only";

/**
 * Outbound email via Microsoft Graph (client credentials).
 *
 * The site never writes to Box & Dice — website enquiries are delivered by
 * email only. This module is the single place that sends anything.
 *
 * Required environment variables (set them in Vercel, never in the repo):
 *   MS_TENANT_ID       Directory (tenant) ID from the Azure app registration
 *   MS_CLIENT_ID       Application (client) ID
 *   MS_CLIENT_SECRET   Client secret VALUE (not the secret ID)
 *   ENQUIRY_FROM       Mailbox that sends, e.g. michael@loutakis.com.au
 *   ENQUIRY_TO         Recipients, comma separated
 *
 * The app registration needs the APPLICATION permission Mail.Send with admin
 * consent granted. Delegated Mail.Send will not work for a server-side send.
 */

const TENANT_ID = process.env.MS_TENANT_ID;
const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const FROM = process.env.ENQUIRY_FROM;
const TO = (process.env.ENQUIRY_TO ?? FROM ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function mailIsConfigured(): boolean {
  return Boolean(TENANT_ID && CLIENT_ID && CLIENT_SECRET && FROM && TO.length);
}

/** Escape anything that goes into the HTML body. Enquiry text is untrusted. */
function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** App-only Graph token. Shared with lib/sharepoint.ts — same app, same tenant. */
export async function getAccessToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(`Graph token request failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Graph token response had no access_token");
  return json.access_token;
}

/**
 * Send an email as ENQUIRY_FROM. The general-purpose primitive — sendEnquiry
 * below is one caller, the portal is another.
 */
export async function sendMail(opts: {
  to: string[];
  subject: string;
  html: string;
  replyTo?: { address: string; name?: string };
}): Promise<void> {
  if (!mailIsConfigured()) throw new Error("Email is not configured");

  const token = await getAccessToken();

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(FROM!)}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: opts.subject,
          body: { contentType: "HTML", content: opts.html },
          toRecipients: opts.to.map((address) => ({ emailAddress: { address } })),
          ...(opts.replyTo
            ? {
                replyTo: [
                  { emailAddress: { address: opts.replyTo.address, name: opts.replyTo.name } },
                ],
              }
            : {}),
        },
        saveToSentItems: false,
      }),
      cache: "no-store",
    }
  );

  if (!res.ok) throw new Error(`Graph sendMail failed: ${res.status} ${await res.text()}`);
}

/** Recipients for internal notifications (ENQUIRY_TO). */
export function officeRecipients(): string[] {
  return TO;
}

export { esc };

export type Enquiry = {
  name: string;
  email: string;
  phone?: string;
  message: string;
  listingId?: string;
  listingAddress?: string;
  pageUrl?: string;
  /** Overrides ENQUIRY_TO — used to route a listing enquiry to its own agent.
   *  Must be resolved SERVER-SIDE from the CRM, never taken from the browser. */
  to?: string[];
};

/**
 * Send one website enquiry. Throws on failure so the caller can tell the
 * visitor honestly rather than showing a false confirmation.
 */
export async function sendEnquiry(enq: Enquiry): Promise<void> {
  if (!mailIsConfigured()) {
    throw new Error(
      "Email is not configured — set MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, ENQUIRY_FROM and ENQUIRY_TO"
    );
  }

  const recipients = enq.to?.length ? enq.to : TO;

  const token = await getAccessToken();

  const subject = enq.listingAddress
    ? `Website enquiry — ${enq.listingAddress}`
    : "Website enquiry";

  const rows: Array<[string, string]> = [
    ["Name", enq.name],
    ["Email", enq.email],
    ["Phone", enq.phone || "—"],
    ["Property", enq.listingAddress || "General enquiry"],
    ["Listing ID", enq.listingId || "—"],
    ["Page", enq.pageUrl || "—"],
    ["Received", new Date().toLocaleString("en-AU", { timeZone: "Australia/Melbourne" })],
  ];

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111">
      <p style="margin:0 0 16px"><strong>New enquiry from the website.</strong></p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:4px 16px 4px 0;color:#666;vertical-align:top">${esc(
                k
              )}</td><td style="padding:4px 0">${esc(v)}</td></tr>`
          )
          .join("")}
      </table>
      <p style="margin:0 0 6px;color:#666">Message</p>
      <div style="padding:12px 14px;background:#f6f6f6;border-radius:4px;white-space:pre-wrap">${esc(
        enq.message
      )}</div>
      <p style="margin:20px 0 0;color:#999;font-size:13px">
        Reply directly to this email to answer ${esc(enq.name)}.
      </p>
    </div>
  `;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(FROM!)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients: recipients.map((address) => ({ emailAddress: { address } })),
          // So hitting Reply in Outlook answers the buyer, not ourselves.
          replyTo: [{ emailAddress: { address: enq.email, name: enq.name } }],
        },
        saveToSentItems: false,
      }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(`Graph sendMail failed: ${res.status} ${await res.text()}`);
  }
}
