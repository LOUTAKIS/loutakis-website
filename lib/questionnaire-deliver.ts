import "server-only";
import { sendMail, officeRecipients, esc, type MailAttachment } from "./mail";
import { createToken } from "./portal-token";
import { addContactNote } from "./boxdice-write";
import { updateQuestionnaire, type Questionnaire } from "./questionnaire";
// The same helpers the campaign uses — a questionnaire's `vendors` is the same
// shape, so the reading of it is shared rather than written twice.
import { campaignVendors as questionnaireVendors, vendorEmails, vendorGreeting } from "./vendors";
import { questionnairePdf, pdfFilename } from "./questionnaire-pdf";
import { isShown, answerText, fieldLabel, type Answers, type Section } from "./questionnaire-form";
import { getLiveSections } from "./questionnaire-questions";
import { fmtDate } from "./when";

/**
 * The vendor's side of the questionnaire: the link they get, and what happens
 * to their answers when they press Send.
 *
 * Three destinations, in a deliberate order — the PDF and the email to the
 * agent first, because that is the copy a person will actually act on, then the
 * CRM note, then our own status.
 */

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://loutakis-website.vercel.app").replace(/\/$/, "");
}

/**
 * 90 days. Longer than the marketing approval link, because this one is sent at
 * the start of a campaign and a vendor may sit on it for weeks — an expired
 * link is a phone call, and a phone call is how the questionnaire stops getting
 * filled in.
 */
export function questionnaireLink(id: string): string {
  return `${siteUrl()}/questionnaire/${id}?t=${createToken("questionnaire", id, 90)}`;
}

/**
 * The questions a given questionnaire asked.
 *
 * The snapshot if it has one, the live set if it does not — a record written
 * before snapshotting existed, or one still in flight.
 */
export function askedOf(q: Questionnaire, live: Section[]): Section[] {
  return q.asked?.length ? q.asked : live;
}

/** The answers as plain text — the CRM note, and the body of the agent's email. */
export function answersAsText(q: Questionnaire, sections: Section[]): string {
  const out: string[] = [
    `PROPERTY INFORMATION — ${q.address} (listing ${q.listingId})`,
    q.submittedName ? `Completed by ${q.submittedName}` : "",
    q.submittedAt ? `Received ${fmtDate(q.submittedAt)}` : "",
    "",
  ].filter((l) => l !== "");

  for (const section of sections) {
    const live = section.fields.filter((f) => isShown(f, q.answers));
    if (!live.length) continue;
    out.push(section.title.toUpperCase(), "");
    for (const f of live) {
      if (f.kind === "files") continue; // The files are on the email, not in the text.
      const a = answerText(f, q.answers);
      out.push(`${fieldLabel(f)}:`, a || "(not answered)", "");
    }
  }

  out.push(
    "Given by the vendor and recorded as given. Not a statement by Loutakis Real Estate, and not a",
    "substitute for the vendor statement or any disclosure required under the Sale of Land Act."
  );
  return out.join("\n");
}

/** The answers as HTML, for the body of the agent's email. */
function answersAsHtml(q: Questionnaire, sections: Section[]): string {
  const blocks: string[] = [];
  for (const section of sections) {
    const live = section.fields.filter((f) => isShown(f, q.answers) && f.kind !== "files");
    if (!live.length) continue;
    blocks.push(
      `<p style="margin:30px 0 14px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#666">${esc(section.title)}</p>`
    );
    for (const f of live) {
      const a = answerText(f, q.answers);
      blocks.push(
        `<p style="margin:0 0 16px"><strong style="display:block;font-size:13px;color:#111">${esc(fieldLabel(f))}</strong>` +
          `<span style="color:${a ? "#333" : "#999"};white-space:pre-wrap">${esc(a || "Not answered")}</span></p>`
      );
    }
  }
  return blocks.join("");
}

export async function sendQuestionnaireLink(q: Questionnaire, sentBy: string): Promise<void> {
  await sendMail({
    to: vendorEmails(q),
    subject: `A few questions about ${q.address}`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111;line-height:1.55">
        <p>Hi ${esc(vendorGreeting(q))},</p>
        <p>Before we start putting the campaign together for <strong>${esc(q.address)}</strong>, there are some things only you can tell us — what you love about the home, what's been done to it over the years, and anything a buyer will ask that we'd rather hear from you first.</p>
        <p style="margin:26px 0">
          <a href="${questionnaireLink(q.id)}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 28px;font-size:13px;letter-spacing:.12em;text-transform:uppercase">Answer the questions</a>
        </p>
        <p style="color:#666">It takes about ten minutes. Your answers are kept as you type, so you can close it and come back to this link on the same device. The first question is the one we build your brochure around, so it's worth the time.</p>
      </div>
    `,
    replyTo: { address: sentBy, name: "Loutakis Real Estate" },
  });

  await updateQuestionnaire(q.id, { status: "sent", sentAt: new Date().toISOString(), sentBy });
}

/** Called every time the questionnaire page renders with a valid link. */
export async function recordQuestionnaireOpen(q: Questionnaire): Promise<void> {
  const patch: Partial<Questionnaire> = {
    openCount: (q.openCount ?? 0) + 1,
    openedAt: new Date().toISOString(),
  };
  // Only "sent" becomes "opened" — never walk a complete one backwards.
  if (q.status === "sent") patch.status = "opened";
  await updateQuestionnaire(q.id, patch).catch((err) =>
    console.error("[questionnaire] open record failed", err)
  );
}

/**
 * Finished. The PDF and the email go out first, then the CRM note, then status.
 *
 * The note is written on the VENDOR'S CONTACT CARD, with the address at the top
 * of it — not on the listing. Box & Dice's Website API has no note endpoint for
 * listings and no upload endpoint at all, so the contact card is the only place
 * in the CRM a record of this can land automatically. The PDF is how it gets
 * onto the property: it arrives on the agent's email and can be downloaded
 * again from the dashboard at any time.
 *
 * A CRM failure does not fail the submission. The vendor has typed for ten
 * minutes and pressed Send; losing that to a 429 from Box & Dice would be
 * unforgivable, and the email — which has already gone — carries everything.
 */
export async function submitQuestionnaire(
  q: Questionnaire,
  name: string,
  answers: Answers,
  files: MailAttachment[]
): Promise<void> {
  const at = new Date().toISOString();

  /**
   * FROZEN HERE, NOT AT SEND. The questions this vendor actually answered are
   * recorded with their answers, so rewording or retiring one later cannot
   * change what this record appears to have asked. Taking the snapshot at
   * submit rather than at send means a question fixed this morning still
   * reaches a link that went out last week.
   */
  const asked = await getLiveSections().catch(() => [] as Section[]);
  const finished: Questionnaire = {
    ...q,
    answers,
    submittedName: name,
    submittedAt: at,
    status: "complete",
    ...(asked.length ? { asked } : {}),
  };

  let pdf: Uint8Array | null = null;
  try {
    pdf = await questionnairePdf({
      address: q.address,
      sections: asked,
      answers,
      submittedName: name,
      submittedAt: at,
      vendors: questionnaireVendors(q),
      attachments: files.map((f) => f.name),
    });
  } catch (err) {
    // Without the document the email still carries every answer in its body.
    console.error("[questionnaire] pdf failed", err);
  }

  const attachments: MailAttachment[] = [
    ...(pdf
      ? [{ name: pdfFilename(q.address), contentType: "application/pdf", content: pdf }]
      : []),
    ...files,
  ];

  // The agent on the listing, with the office copied so nothing sits unread in
  // one person's inbox while they're on leave.
  const to = q.agentEmail ? [q.agentEmail] : officeRecipients();
  const cc = q.agentEmail ? officeRecipients() : [];
  await sendMail({
    to,
    cc,
    subject: `Property information — ${q.address}`,
    attachments,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111;line-height:1.55">
        <p><strong>${esc(name)}</strong> has completed the property information form for <strong>${esc(q.address)}</strong>.</p>
        <p style="color:#666">${pdf ? "The PDF is attached — drop it on the listing in Box &amp; Dice or into the property's SharePoint folder." : "The PDF could not be generated this time; every answer is below."}${files.length ? ` ${files.length} file${files.length === 1 ? "" : "s"} from the vendor ${files.length === 1 ? "is" : "are"} attached as well.` : ""}</p>
        <div style="margin-top:8px;border-top:1px solid #e0e0e0">${answersAsHtml(finished, asked)}</div>
        <p style="margin-top:30px"><a href="${siteUrl()}/staff/questionnaires/${q.id}">Open it on the dashboard</a></p>
      </div>
    `,
    replyTo: (() => {
      const v = questionnaireVendors(q)[0];
      return v?.email ? { address: v.email, name: v.name } : undefined;
    })(),
  });

  await addContactNote(
    { name, email: vendorEmails(q)[0] ?? "" },
    answersAsText(finished, asked)
  ).catch((err) => console.error("[questionnaire] CRM note failed", err));

  await updateQuestionnaire(q.id, {
    answers,
    submittedName: name,
    submittedAt: at,
    status: "complete",
    ...(asked.length ? { asked } : {}),
  });
}
