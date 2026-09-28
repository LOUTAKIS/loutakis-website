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

/**
 * The office address that must never be left off an internal notification.
 *
 * In the code rather than in ENQUIRY_TO on purpose. ENQUIRY_TO is a setting —
 * someone can edit it in Vercel at two in the morning to route something
 * somewhere, and admin would fall off the list without anyone noticing until a
 * vendor's answers had gone missing for a month. This is a standing rule about
 * how the business runs, not a preference, so it is written down where it
 * cannot be edited by accident.
 *
 * Always in CC, never the sole recipient: the named agent is still the person
 * being asked to do something.
 */
export const ADMIN_EMAIL = "admin@loutakis.com.au";

/** Everyone who should see an internal notification, admin included, deduped. */
export function withAdmin(addresses: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of [...addresses, ADMIN_EMAIL]) {
    const k = a.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(a.trim());
  }
  return out;
}

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
export type MailAttachment = {
  name: string;
  /** Anything Outlook can't guess from the name will download rather than preview. */
  contentType: string;
  content: Uint8Array | Buffer;
};

/**
 * Graph's limit on a message built in one request is about 4 MB once the bytes
 * are base64'd — past that it wants an upload session against a saved draft,
 * which is a different and much longer dance. Anything approaching the limit is
 * dropped with a log rather than failing the send, because the answers in the
 * body of the email matter more than the attachment, and a vendor's 30 MB
 * scan must never be the reason their questionnaire never arrives.
 */
const ATTACHMENT_BUDGET = 3_000_000;

export async function sendMail(opts: {
  to: string[];
  /** Kept in the loop without being the person expected to act. */
  cc?: string[];
  subject: string;
  html: string;
  replyTo?: { address: string; name?: string };
  attachments?: MailAttachment[];
  /**
   * Send AS this mailbox instead of ENQUIRY_FROM.
   *
   * For anything a vendor reads: a request to approve a marketing campaign
   * should arrive from the agent who is selling their house, not from a
   * generic office address. The app registration holds tenant-wide Mail.Send,
   * so any mailbox in the tenant can be used — and because it is still a
   * loutakis.com.au mailbox sent through Graph, SPF, DKIM and DMARC all pass
   * exactly as they do today.
   *
   * THERE IS NO FALLBACK. If this mailbox cannot send, nothing is sent and a
   * MailSendError is thrown naming it. Quietly substituting the office address
   * would mean a vendor receiving an approval request from someone they have
   * never dealt with, and nobody finding out — the wrong sender is not a
   * smaller problem than no email, it is a quieter one.
   */
  from?: string;
}): Promise<void> {
  if (!mailIsConfigured()) throw new Error("Email is not configured");

  const attachments: Array<Record<string, unknown>> = [];
  let budget = ATTACHMENT_BUDGET;
  for (const a of opts.attachments ?? []) {
    const bytes = Buffer.from(a.content);
    // base64 is four bytes out for every three in.
    const cost = Math.ceil(bytes.length / 3) * 4;
    if (cost > budget) {
      console.error(`[mail] attachment "${a.name}" (${bytes.length} bytes) skipped — over the message budget`);
      continue;
    }
    budget -= cost;
    attachments.push({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: a.name,
      contentType: a.contentType,
      contentBytes: bytes.toString("base64"),
    });
  }

  const token = await getAccessToken();

  const sender = opts.from?.trim() || FROM!;

  const body = JSON.stringify({
        message: {
          subject: opts.subject,
          body: { contentType: "HTML", content: opts.html },
          toRecipients: opts.to.map((address) => ({ emailAddress: { address } })),
          /**
           * Anyone already in `to` is dropped from cc — Graph accepts the
           * duplicate and Outlook shows the same person twice, which reads as
           * a mistake. Matched case-insensitively, since addresses are.
           */
          ...(opts.cc?.length
            ? {
                ccRecipients: opts.cc
                  .filter(
                    (address) =>
                      !opts.to.some((t) => t.toLowerCase() === address.toLowerCase())
                  )
                  .map((address) => ({ emailAddress: { address } })),
              }
            : {}),
          ...(opts.replyTo
            ? {
                replyTo: [
                  { emailAddress: { address: opts.replyTo.address, name: opts.replyTo.name } },
                ],
              }
            : {}),
          ...(attachments.length ? { attachments } : {}),
        },
        saveToSentItems: false,
  });

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body,
      cache: "no-store",
    }
  );
  if (res.ok) return;

  const detail = `${res.status} ${(await res.text()).slice(0, 300)}`;
  throw new MailSendError(`Graph sendMail failed: ${detail}`, sender, res.status);
}

/**
 * A send that failed, with the mailbox it was attempted from.
 *
 * Carried rather than flattened into a string so a caller can tell "that
 * agent's mailbox won't send" from "the message was malformed", and raise the
 * alarm about the former without pretending it can fix it.
 */
export class MailSendError extends Error {
  constructor(
    message: string,
    readonly sender: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "MailSendError";
  }
}

/**
 * Tell the office that something a vendor should have received did not go.
 *
 * Sent from ENQUIRY_FROM deliberately — this is the one email that must not
 * depend on the mailbox that just failed. It is best effort: if even this
 * cannot be sent the log is all that is left, and that is the end of what
 * software can do about it.
 */
export async function alertMailFailure(input: {
  what: string;
  address: string;
  attemptedFrom: string;
  detail: string;
  link?: string;
}): Promise<void> {
  console.error(
    `[mail] ALERT — ${input.what} for ${input.address} not sent from ${input.attemptedFrom}: ${input.detail}`
  );
  try {
    await sendMail({
      to: withAdmin(TO),
      subject: `NOT SENT — ${input.what} for ${input.address}`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111;line-height:1.55">
          <p style="color:#b45309"><strong>An email to the vendor was not sent.</strong></p>
          <p><strong>${esc(input.what)}</strong> for <strong>${esc(input.address)}</strong> could not be sent from <strong>${esc(input.attemptedFrom)}</strong>, and nothing was sent in its place — these have to come from the listing agent.</p>
          <p style="color:#666">Usually this means that address isn't a mailbox in the Loutakis tenant, or the consultant's email in Box &amp; Dice is wrong. Fix it there and send again.</p>
          <pre style="background:#f4f4f4;padding:12px 14px;font-size:12px;white-space:pre-wrap;color:#444">${esc(input.detail)}</pre>
          ${input.link ? `<p><a href="${input.link}">Open it</a></p>` : ""}
        </div>
      `,
    });
  } catch (err) {
    console.error("[mail] the failure alert itself could not be sent", err);
  }
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
