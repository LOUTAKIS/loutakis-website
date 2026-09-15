import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getStaff } from "@/lib/staff-auth";
import { getQuestionnaire, questionnaireVendors } from "@/lib/questionnaire";
import { questionnaireLink } from "@/lib/questionnaire-deliver";
import { SECTIONS, isShown, answerText, fieldLabel } from "@/lib/questionnaire-form";
import { fmtDate } from "@/lib/when";
import CopyLink from "@/components/CopyLink";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * One questionnaire: the answers, and the link to chase.
 *
 * Unanswered questions are shown greyed rather than hidden — a page that
 * silently drops them reads as though everything was covered, and the gap is
 * exactly what you want to see before you ring the vendor.
 */
export default async function QuestionnaireDetail({ params }: { params: { id: string } }) {
  const staff = getStaff();
  if (!staff) redirect("/staff");

  const q = await getQuestionnaire(params.id);
  if (!q) notFound();

  const vendors = questionnaireVendors(q);
  const done = q.status === "complete";

  return (
    <section className="portal-page">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <Link href="/staff/questionnaires" className="backlink">← Property information</Link>
        <div className="section-head">
          <div>
            <div className="eyebrow">
              {done
                ? `Completed ${q.submittedAt ? fmtDate(q.submittedAt) : ""}`
                : q.status === "started"
                  ? "Started, not sent"
                  : q.openCount > 0
                    ? "Opened, nothing filled in"
                    : "Sent, not opened"}
            </div>
            <h2>{q.address}</h2>
          </div>
          {done && (
            <a className="btn" href={`/api/staff/questionnaires/${q.id}/pdf`}>
              Download PDF
            </a>
          )}
        </div>

        <p className="portal-intro">
          {vendors.map((v) => (v.name ? `${v.name} <${v.email}>` : v.email)).join(" · ")}
          {q.agentName && ` — ${q.agentName}`}
        </p>

        <div className="wa-figures">
          <div>
            <div className="wa-n">{q.sentAt ? fmtDate(q.sentAt) : "—"}</div>
            <div className="wa-l">Sent</div>
          </div>
          <div>
            <div className="wa-n">{q.openCount}</div>
            <div className="wa-l">Times opened</div>
          </div>
          <div>
            <div className="wa-n">{q.submittedAt ? fmtDate(q.submittedAt) : "—"}</div>
            <div className="wa-l">Completed</div>
          </div>
        </div>

        {!done && (
          <div className="portal-done" style={{ marginTop: 34 }}>
            <h3>Still waiting</h3>
            <p>
              {q.status === "started"
                ? "They've started and saved it. A nudge usually finishes the job."
                : "Send them the link again, or read it out over the phone and fill it in with them."}
            </p>
            <CopyLink url={questionnaireLink(q.id)} label="Copy their link" />
          </div>
        )}

        {(done || q.status === "started") && (
          <div className="qs-answers">
            {SECTIONS.map((section) => {
              const live = section.fields.filter((f) => isShown(f, q.answers ?? {}));
              if (!live.length) return null;
              return (
                <div key={section.title}>
                  <div className="times-label" style={{ marginTop: 40 }}>{section.title}</div>
                  <dl className="qs-dl">
                    {live.map((f) => {
                      const a = f.kind === "files" ? "" : answerText(f, q.answers ?? {});
                      return (
                        <div key={f.id}>
                          <dt>{fieldLabel(f)}</dt>
                          <dd className={a ? undefined : "qs-empty"}>
                            {f.kind === "files"
                              ? "Any files came attached to the email."
                              : a || "Not answered"}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
