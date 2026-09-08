import { NextResponse } from "next/server";
import { sendMail, officeRecipients, esc, mailIsConfigured } from "@/lib/mail";
import { getConsultantOptions, defaultConsultant } from "@/lib/boxdice";
import { createContact, createAppraisalLead, type AppraisalAddress } from "@/lib/boxdice-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Sell with us" — an appraisal request.
 *
 * A seller asking us to sell their home is the most valuable thing this site
 * receives, so it goes into the CRM properly rather than only as an email:
 * a contact, then a sales lead against that contact through
 * `POST /appraisal_leads`. The office is emailed either way, so a lead is
 * never lost to a CRM outage.
 */

function clean(v: unknown, max = 300): string {
  return String(v ?? "").trim().slice(0, max);
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Street types Box & Dice recognises, longest first so "Street" beats "St". */
const STREET_TYPES = [
  "Street", "Road", "Avenue", "Parade", "Crescent", "Terrace", "Boulevard", "Esplanade",
  "Highway", "Circuit", "Close", "Court", "Drive", "Grove", "Place", "Square", "Lane",
  "Rise", "Walk", "Way", "Mews", "St", "Rd", "Ave", "Pde", "Cres", "Tce", "Blvd", "Hwy",
  "Cct", "Cl", "Ct", "Dr", "Gr", "Pl", "Sq", "Ln",
];

/**
 * Split "12/34 Smith Street" into the parts the CRM stores separately.
 *
 * Best effort only: Australian addresses are typed a hundred ways and a wrong
 * guess is worse than a blank field, so anything unrecognised is simply left
 * out — the seller's exact words always travel in the lead's comment.
 */
function parseStreet(input: string): AppraisalAddress {
  const out: AppraisalAddress = {};
  let rest = input.trim().replace(/,+$/, "");
  if (!rest) return out;

  const unit = rest.match(/^([\dA-Za-z]+)\s*\/\s*(.*)$/);
  if (unit) {
    out.unit = unit[1];
    rest = unit[2];
  }

  const num = rest.match(/^(\d+[A-Za-z]?(?:\s*-\s*\d+[A-Za-z]?)?)\s+(.*)$/);
  if (num) {
    out.number = num[1].replace(/\s+/g, "");
    rest = num[2];
  }

  const words = rest.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const last = words[words.length - 1].replace(/\.$/, "");
    const match = STREET_TYPES.find((t) => t.toLowerCase() === last.toLowerCase());
    if (match) {
      out.street_type = match;
      words.pop();
    }
  }
  if (words.length) out.street_name = words.join(" ");
  return out;
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const firstName = clean(body.firstName, 80);
  const lastName = clean(body.lastName, 80);
  const email = clean(body.email, 160).toLowerCase();
  const phone = clean(body.phone, 40);
  const street = clean(body.street, 200);
  const suburbName = clean(body.suburbName, 80);
  const postcode = clean(body.postcode, 10);

  if (!firstName) return NextResponse.json({ ok: false, error: "Please add your first name." }, { status: 400 });
  if (!street) return NextResponse.json({ ok: false, error: "Please add the address of the property." }, { status: 400 });
  if (!EMAIL.test(email)) return NextResponse.json({ ok: false, error: "Please add a valid email address." }, { status: 400 });

  // Honeypot: a real person never fills a field they cannot see.
  if (clean(body.company, 80)) return NextResponse.json({ ok: true });

  /**
   * The agent is sent as a Box & Dice consultant id and checked against the
   * CRM's own list. Nothing from the browser is trusted as an identity, and an
   * unknown or missing id falls back to the default consultant rather than
   * losing the lead.
   */
  const consultants = await getConsultantOptions();
  const wantedId = Number(body.consultantId);
  const chosen = consultants.find((c) => c.id === wantedId) ?? defaultConsultant(consultants);

  const answers: Array<[string, string]> = [
    ["Last sold", clean(body.lastSold, 120)],
    ["Preferred method of sale", clean(body.methodOfSale, 80)],
    ["Hoping to come to market", clean(body.timeframe, 80)],
    ["Thinks it's worth", clean(body.expectedValue, 80)],
    ["Improvements made", clean(body.improvements, 400)],
    ["Agent", chosen?.name ?? "unassigned"],
    ["Best time to call", clean(body.contactWhen, 120)],
    ["Heard about us via", (Array.isArray(body.heardAbout) ? body.heardAbout : []).map((h: unknown) => clean(h, 60)).filter(Boolean).join(", ")],
  ].filter(([, v]) => Boolean(v)) as Array<[string, string]>;

  const address = [street, suburbName, postcode].filter(Boolean).join(", ");
  const comment = [
    `Appraisal request from the website`,
    `Property: ${address}`,
    `From: ${firstName} ${lastName} · ${email}${phone ? ` · ${phone}` : ""}`,
    ``,
    ...answers.map(([k, v]) => `${k}: ${v}`),
  ].join("\n");

  /**
   * The CRM first, then the email. A seller who reaches this point has done
   * the work of filling in a long form; the office hears about it even if
   * Box & Dice is unreachable, so the two are reported separately below.
   */
  let crm: { ok: boolean; detail: string } = { ok: false, detail: "not attempted" };
  try {
    const contact = await createContact({
      first_name: firstName,
      last_name: lastName || "—",
      email,
      mobile: phone || undefined,
      // Asking us to sell is not consent to a mailing list.
      permit_email_campaign: false,
      permit_sms: false,
    });
    const contactId = Number((contact.body as any)?.id);

    if (!contactId) {
      crm = { ok: false, detail: `contact create returned ${contact.status}` };
    } else if (!chosen) {
      // Only reachable when the CRM returned no consultants at all.
      crm = { ok: false, detail: "no consultants available — contact created, no lead" };
    } else {
      const lead = await createAppraisalLead({
        consultantId: chosen.id,
        contactId,
        address: { ...parseStreet(street), suburb: suburbName || undefined, postcode: postcode || undefined, state: "VIC" },
        temperature: clean(body.timeframe, 80).startsWith("0") ? "hot" : "warm",
        subject: `Appraisal request — ${address}`,
        comment,
      });
      crm =
        lead.status >= 200 && lead.status < 300
          ? { ok: true, detail: `lead ${(lead.body as any)?.id ?? "created"} for ${chosen.name}` }
          : { ok: false, detail: `lead create returned ${lead.status}: ${JSON.stringify(lead.body).slice(0, 200)}` };
    }
  } catch (err) {
    console.error("[appraisal] CRM write failed", err);
    crm = { ok: false, detail: err instanceof Error ? err.message : "unknown error" };
  }

  let mailed = false;
  if (mailIsConfigured()) {
    const rows = answers
      .map(([k, v]) => `<tr><td style="padding:6px 16px 6px 0;color:#666;vertical-align:top">${esc(k)}</td><td style="padding:6px 0">${esc(v)}</td></tr>`)
      .join("");
    mailed = await sendMail({
      to: officeRecipients(),
      /**
       * The CRM outcome goes in the SUBJECT, not just the body. A failed write
       * that is only mentioned three paragraphs down gets skimmed past, and the
       * lead sits in an inbox instead of Lead Flow until someone notices. In
       * the subject it is unmissable in the message list itself.
       */
      subject: crm.ok
        ? `APPRAISAL REQUEST — ${address}`
        : `APPRAISAL REQUEST — NOT IN CRM — ${address}`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111;line-height:1.55">
          <p style="font-size:17px"><strong>${esc(firstName)} ${esc(lastName)}</strong> wants an appraisal for <strong>${esc(address)}</strong>.</p>
          <p><a href="mailto:${esc(email)}">${esc(email)}</a>${phone ? ` · <a href="tel:${esc(phone.replace(/\s+/g, ""))}">${esc(phone)}</a>` : ""}</p>
          <table style="margin:18px 0;border-collapse:collapse;font-size:14px">${rows}</table>
          <p style="color:#666;font-size:13px">${crm.ok ? `In Box &amp; Dice: ${esc(crm.detail)}.` : `<strong>Not in Box &amp; Dice</strong> (${esc(crm.detail)}) — add it by hand.`}</p>
        </div>
      `,
      replyTo: { address: email, name: `${firstName} ${lastName}`.trim() },
    })
      .then(() => true)
      .catch((err) => {
        console.error("[appraisal] office email failed", err);
        return false;
      });
  }

  /**
   * Both paths failed, so nothing anywhere recorded this seller.
   *
   * Saying "thank you, we'll be in touch" to someone whose enquiry has been
   * dropped on the floor is the worst outcome this route has: they wait, we
   * never call, and they list with whoever answered. Tell them the truth and
   * give them the phone number instead.
   */
  if (!crm.ok && !mailed) {
    console.error("[appraisal] LEAD LOST — no CRM record and no email:", crm.detail);
    return NextResponse.json(
      {
        ok: false,
        error: "We couldn't submit that just now. Please call Michael on 0409 438 025 — we don't want to lose your enquiry.",
      },
      { status: 502 }
    );
  }

  // `crm` is reported so the browser can record whether Box & Dice took the
  // lead. The seller is never shown it — from their side, mail alone is enough.
  return NextResponse.json({ ok: true, crm: crm.ok });
}
