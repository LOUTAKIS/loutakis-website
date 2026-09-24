import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff-auth";
import { getQuestionSet } from "@/lib/questionnaire-questions";
import { fmtDate } from "@/lib/when";
import QuestionEditor from "@/components/QuestionEditor";

export const metadata = {
  title: "The questions — Loutakis Real Estate",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Editing what vendors are asked.
 *
 * Retired questions are shown here and nowhere else — the editor is the only
 * place you can see one to bring it back.
 */
export default async function QuestionsPage() {
  const staff = getStaff();
  if (!staff) redirect("/staff");

  const set = await getQuestionSet();
  const live = set.sections.flatMap((s) => s.fields).filter((f) => !f.retired).length;

  return (
    <section className="portal-page">
      <div className="wrap col-wide">
        <Link href="/staff/questionnaires" className="backlink">← Property information</Link>
        <div className="section-head">
          <div>
            <div className="eyebrow">
              {live} question{live === 1 ? "" : "s"}
              {set.updatedAt ? ` · last changed ${fmtDate(set.updatedAt)}` : ""}
            </div>
            <h2>The questions</h2>
          </div>
          <Link href="/staff/questionnaires/preview" className="btn">See it as a vendor</Link>
        </div>

        <p className="portal-intro">
          What every vendor is asked. Changes reach anyone who hasn&rsquo;t answered yet, including
          links already sent — so a question fixed this morning is fixed for everyone still
          holding one. A questionnaire that has already been answered keeps the questions it was
          answered with.
        </p>

        <QuestionEditor
          initial={set.sections}
          updatedAt={set.updatedAt}
          updatedBy={set.updatedBy}
        />
      </div>
    </section>
  );
}
