import { getMarketingSource } from "@/lib/boxdice";
import { demoConfigured, isUnlocked, getDemoCampaign } from "@/lib/demo-approval";
import VendorFrame from "@/components/vendor/VendorFrame";
import { buildChapters, ChapterSections } from "@/components/vendor/Chapters";
import DemoGate from "@/components/DemoGate";

export const metadata = {
  title: "Marketing approval — Loutakis Real Estate",
  // Off the open web: not indexed, not followed, not archived, not snippeted.
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};
export const dynamic = "force-dynamic";

/**
 * The example a prospective vendor is shown.
 *
 * The listing presentation email promises that they will review and approve
 * their marketing on a page of their own, and then asks them to imagine it.
 * This is that page, with a real campaign in it, behind a shared password.
 *
 * NOBODY'S NAME APPEARS HERE. The property is already publicly advertised, so
 * the address, board, brochure, copy and photographs cost that vendor nothing.
 * Their names, their email addresses and the record of who approved what are
 * not rendered on this route at all — they agreed to approve their own
 * marketing, not to appear in somebody else's sales material.
 *
 * The approval section is deliberately shown and deliberately inert: the whole
 * point is that a seller sees the button they will press.
 */
export default async function MarketingApprovalDemo() {
  if (!demoConfigured()) {
    return (
      <section className="va-expired">
        <div>
          <div className="eyebrow">Loutakis Real Estate</div>
          <h2>Not available</h2>
          <p>This example isn&rsquo;t switched on.</p>
        </div>
      </section>
    );
  }

  if (!isUnlocked()) return <DemoGate />;

  // The frozen copy, not the live campaign: this page must not change when the
  // campaign behind it does.
  const c = await getDemoCampaign();
  if (!c) {
    return (
      <section className="va-expired">
        <div>
          <div className="eyebrow">Loutakis Real Estate</div>
          <h2>Nothing to show yet</h2>
          <p>No example has been chosen.</p>
        </div>
      </section>
    );
  }

  const source = await getMarketingSource(c.listingId);
  // No token: the file routes recognise the nominated demo campaign for anyone
  // holding the password, and only that one.
  const { chapters, markers, hero } = buildChapters(c, source, "");

  return (
    <div className="va2">
      <VendorFrame address={c.address} markers={markers} approved={false} />
      <div className="va-demo">
        An example — this is what your own marketing approval will look like. Nothing here can be
        changed or sent.
      </div>

      <section className="vh" style={hero ? { backgroundImage: `url(${hero})` } : undefined}>
        <div className="vh-inner">
          <h1>{c.address}</h1>
        </div>
        <a href={`#${markers[0]?.id ?? "approve"}`} className="vh-scroll" aria-label="Scroll to begin">
          <i />
        </a>
      </section>

      <ChapterSections chapters={chapters} />

      <section className="vch vch-approve" id="approve">
        <div className="vch-head">
          <h2>Your approval</h2>
          <p className="vch-blurb">
            At the end of your own page there&rsquo;s a box for your name and two buttons: approve
            it, or tell us what to change. Whatever you write comes straight to Michael, and nothing
            goes to print until you&rsquo;ve signed off. If there are two of you on the title, you
            each get your own link and we wait for both.
          </p>
        </div>
        <div className="vch-body">
          <div className="vdone">
            <div className="vdone-mark">✓</div>
            <h3>That&rsquo;s the whole process.</h3>
            <p>
              No printing, no scanning, no attachments to find later. One link, on your phone, and
              a record of exactly what you agreed to.
            </p>
            <p className="vp-note">
              Questions about any of it — Michael is on{" "}
              <a href="tel:0409438025">0409&nbsp;438&nbsp;025</a>.
            </p>
          </div>
        </div>
      </section>

      <footer className="vfoot">
        <span>Loutakis Real Estate · 0409 438 025</span>
        <span>It&rsquo;s time to move.</span>
      </footer>
    </div>
  );
}
