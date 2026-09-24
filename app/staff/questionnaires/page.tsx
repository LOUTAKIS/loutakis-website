import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff-auth";
import { listQuestionnaires, questionnaireVendors, type Questionnaire } from "@/lib/questionnaire";
import { fmtDate } from "@/lib/when";

export const metadata = {
  title: "Property information — Loutakis Real Estate",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Every questionnaire, and — the point of the page — who hasn't answered.
 *
 * Sorted so the ones needing a phone call are at the top. A list that puts the
 * finished ones first is a list you stop opening.
 */

function ago(iso: string | null): string {
  if (!iso) return "";
  const m = Math.round((Date.now() - +new Date(iso)) / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  return fmtDate(iso);
}

function StatusLine({ q }: { q: Questionnaire }) {
  switch (q.status) {
    case "sent":
      return <span className="vc-status sent">Sent {ago(q.sentAt)} · not opened yet</span>;
    case "opened":
      return (
        <span className="vc-status opened">
          Opened {ago(q.openedAt)} · nothing filled in yet
        </span>
      );
    case "started":
      return <span className="vc-status draft">Started, saved {ago(q.savedAt)}</span>;
    case "complete":
      return (
        <span className="vc-status approved">
          Completed {ago(q.submittedAt)} by {q.submittedName}
        </span>
      );
  }
}

/** How overdue it is, in days since it was sent — the only nudge worth showing. */
function chase(q: Questionnaire): string | null {
  if (q.status === "complete" || !q.sentAt) return null;
  const days = Math.floor((Date.now() - +new Date(q.sentAt)) / 86_400_000);
  if (days < 5) return null;
  return `${days} days and counting`;
}

export default async function QuestionnairesPage() {
  const staff = getStaff();
  if (!staff) redirect("/staff");

  /**
   * A store that cannot be read is not a reason to show a whole-page error.
   * "Send one" still works from here, which is the thing a staff member came
   * to do — and the diagnostic link says what actually went wrong instead of
   * making them guess at a sorry page.
   */
  let all: Questionnaire[] | null = null;
  try {
    all = await listQuestionnaires();
  } catch (err) {
    console.error("[staff] questionnaires unavailable", err);
  }

  const open = (all ?? []).filter((q) => q.status !== "complete");
  const done = (all ?? []).filter((q) => q.status === "complete");

  return (
    <section className="portal-page">
      <div className="wrap">
        <Link href="/staff" className="backlink">← Dashboard</Link>
        <div className="section-head">
          <div>
            <div className="eyebrow">{staff.name}</div>
            <h2>Property information</h2>
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/staff/questionnaires/preview" className="btn ghost">Preview</Link>
            <Link href="/staff/questionnaires/questions" className="btn ghost">The questions</Link>
            <Link href="/staff/questionnaires/new" className="btn">Send one</Link>
          </div>
        </div>

        <p className="portal-intro">
          The questions we send a vendor once the authority is signed. Their answers arrive as a PDF
          on the listing agent&rsquo;s email and as a note on their contact card in Box &amp; Dice.
        </p>

        {all === null ? (
          <div className="portal-done" style={{ marginTop: 40 }}>
            <h3>Couldn&rsquo;t read the list</h3>
            <p>
              Sending one still works. If this keeps happening,{" "}
              <a href="/api/staff/diag/questionnaires">the diagnostic</a> says why.
            </p>
          </div>
        ) : all.length === 0 ? (
          <div className="portal-done" style={{ marginTop: 40 }}>
            <h3>None sent yet</h3>
            <p>
              Start with Send one — pick the property, add the vendors, and they get a link that
              already knows which home it&rsquo;s about.
            </p>
          </div>
        ) : (
          <>
            {open.length > 0 && (
              <ul className="vc-list">
                {open.map((q) => {
                  const nudge = chase(q);
                  return (
                    <li key={q.id} className="vc-row">
                      <Link href={`/staff/questionnaires/${q.id}`}>
                        <div className="vc-addr">{q.address}</div>
                        <div className="vc-meta">
                          {questionnaireVendors(q)
                            .map((v) => v.name || v.email)
                            .filter(Boolean)
                            .join(" & ")}
                          {q.agentName ? ` · ${q.agentName}` : ""}
                        </div>
                        <StatusLine q={q} />
                        {nudge && <div className="qs-chase">{nudge}</div>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            {done.length > 0 && (
              <>
                <div className="eyebrow" style={{ marginTop: 48 }}>Completed</div>
                <ul className="vc-list done">
                  {done.map((q) => (
                    <li key={q.id}>
                      <Link href={`/staff/questionnaires/${q.id}`}>
                        <div className="vc-addr">{q.address}</div>
                        <StatusLine q={q} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
