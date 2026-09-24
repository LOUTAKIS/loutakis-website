import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff-auth";
import { getLiveSections } from "@/lib/questionnaire-questions";
import QuestionnaireForm from "@/components/QuestionnaireForm";

export const metadata = {
  title: "Preview — Loutakis Real Estate",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * The questionnaire as a vendor sees it, with no vendor and no property.
 *
 * Before this, the only way to look at the form was to send one — which meant
 * either emailing a real vendor to satisfy your own curiosity, or creating a
 * fake record to delete later. Neither is a reasonable answer to "what does it
 * look like now?", and that question gets asked every time a question changes.
 *
 * NOTHING HERE IS SAVED OR SENT. The form is passed `preview`, which makes both
 * of its buttons inert, and the draft it keeps in the browser is under its own
 * key so it can never be mistaken for a real vendor's unfinished answers.
 */
export default async function QuestionnairePreviewPage() {
  const staff = getStaff();
  if (!staff) redirect("/staff");

  const sections = await getLiveSections();
  const count = sections.reduce((n, s) => n + s.fields.length, 0);

  return (
    <section className="portal-page">
      <div className="va-preview">
        Preview — this is what a vendor sees. Nothing you type here is saved or sent.
      </div>
      <div className="wrap qf-page">
        <Link href="/staff/questionnaires" className="backlink">← Property information</Link>
        <div className="section-head" style={{ marginTop: 18 }}>
          <div>
            <div className="eyebrow">
              {count} question{count === 1 ? "" : "s"}
            </div>
            <h2>Property information</h2>
          </div>
          <Link href="/staff/questionnaires/questions" className="btn">
            Edit the questions
          </Link>
        </div>

        <p className="portal-intro">
          On a real one this heading is the property address, and the vendor&rsquo;s name is already
          filled in.
        </p>

        <QuestionnaireForm
          id="preview"
          token=""
          address="19 William Street, Newport"
          vendorName=""
          saved={{}}
          sections={sections}
          preview
        />
      </div>
    </section>
  );
}
