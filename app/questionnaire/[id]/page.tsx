import { getQuestionnaire, questionnaireVendors } from "@/lib/questionnaire";
import { recordQuestionnaireOpen, askedOf } from "@/lib/questionnaire-deliver";
import { getLiveSections } from "@/lib/questionnaire-questions";
import { verifyToken } from "@/lib/portal-token";
import { getStaff } from "@/lib/staff-auth";
import QuestionnaireForm from "@/components/QuestionnaireForm";

export const metadata = {
  title: "Property information — Loutakis Real Estate",
  robots: { index: false, follow: false, noarchive: true },
};
export const dynamic = "force-dynamic";

/**
 * The vendor's questionnaire, reached only by the link in their email.
 *
 * The token is the whole of the authorisation, exactly as the marketing
 * approval page works: no account, no password, and nothing about this property
 * visible to anyone without the link. Staff can preview it with ?preview=1,
 * which does not count as an open.
 */

function Expired() {
  return (
    <section className="va-expired">
      <div>
        <div className="eyebrow">Loutakis Real Estate</div>
        <h2>That link isn&rsquo;t valid</h2>
        <p>
          It may have expired. Call Michael on <a href="tel:0409438025">0409&nbsp;438&nbsp;025</a>{" "}
          and we&rsquo;ll send a fresh one.
        </p>
      </div>
    </section>
  );
}

export default async function QuestionnairePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { t?: string; preview?: string };
}) {
  const token = searchParams?.t ?? "";
  const payload = verifyToken(token);
  const vendorOk = payload?.a === "questionnaire" && payload.c === params.id;
  const isPreview = !vendorOk && searchParams?.preview === "1" && Boolean(getStaff());
  if (!vendorOk && !isPreview) return <Expired />;

  const q = await getQuestionnaire(params.id);
  if (!q) return <Expired />;

  if (vendorOk) await recordQuestionnaireOpen(q);

  /**
   * The live set while it is still being answered, the snapshot once it has
   * been. A vendor half-way through gets today's questions, including any
   * wording fixed since their link was sent; a finished one is never re-asked.
   */
  const live = await getLiveSections();
  const sections = q.status === "complete" ? askedOf(q, live) : live;

  const vendors = questionnaireVendors(q);
  const done = q.status === "complete";

  return (
    <section className="portal-page">
      {isPreview && (
        <div className="va-preview">
          Preview — this is what the vendor sees. Nothing you type here is saved.
        </div>
      )}
      <div className="wrap qf-page">
        <div className="eyebrow">Property information</div>
        <h2>{q.address}</h2>

        {done ? (
          <div className="portal-done" role="status">
            <h3>Already sent — thank you.</h3>
            <p>
              We have your answers for {q.address}. If something needs changing, call Michael on
              0409&nbsp;438&nbsp;025 rather than filling this in twice.
            </p>
          </div>
        ) : (
          <>
            <p className="portal-intro">
              There are things about a home that only the people who have lived in it know, and they
              are usually the things that sell it. This is us asking. About ten minutes — and you
              can stop half way and come back.
            </p>
            <QuestionnaireForm
              id={q.id}
              token={vendorOk ? token : ""}
              address={q.address}
              vendorName={vendors[0]?.name ?? ""}
              saved={q.answers ?? {}}
              sections={sections}
              preview={isPreview}
            />
          </>
        )}
      </div>
    </section>
  );
}
