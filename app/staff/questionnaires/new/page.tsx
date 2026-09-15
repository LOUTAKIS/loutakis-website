import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff-auth";
import { getMarketingSources } from "@/lib/boxdice";
import { listQuestionnaires } from "@/lib/questionnaire";
import SendQuestionnaire from "@/components/SendQuestionnaire";

export const metadata = {
  title: "Send property information — Loutakis Real Estate",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Which property?
 *
 * Every current listing, with no readiness test. A campaign needs photos, copy
 * and a floorplan before it can be assembled; this needs none of that — it goes
 * out the week the authority is signed, which is the week before any of those
 * exist. Filtering on them would hide exactly the listings you want.
 */
export default async function NewQuestionnairePage() {
  const staff = getStaff();
  if (!staff) redirect("/staff");

  const [sources, existing] = await Promise.all([getMarketingSources(false), listQuestionnaires()]);
  const byListing = new Map(existing.map((q) => [q.listingId, q]));

  return (
    <section className="portal-page">
      <div className="wrap" style={{ maxWidth: 760 }}>
        <Link href="/staff/questionnaires" className="backlink">← Property information</Link>
        <div className="eyebrow" style={{ marginTop: 18 }}>Send one</div>
        <h2>Which property?</h2>
        <p className="portal-intro">
          Current listings from Box &amp; Dice. Pick one, add whoever is on the title, and they get
          a link that already knows the address — so nothing is typed twice and nothing lands
          against the wrong home.
        </p>

        {sources.length === 0 ? (
          <div className="portal-done">
            <h3>No current listings</h3>
            <p>Nothing in Box &amp; Dice has status “current” right now.</p>
          </div>
        ) : (
          <SendQuestionnaire
            items={sources.map((s) => {
              const q = byListing.get(s.id);
              return {
                id: s.id,
                address: s.address,
                suburb: s.suburb,
                sent: q ? { id: q.id, status: q.status } : null,
              };
            })}
          />
        )}
      </div>
    </section>
  );
}
