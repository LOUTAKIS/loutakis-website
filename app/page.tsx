import Link from "next/link";
import Image from "next/image";
import { getListings } from "@/lib/boxdice";
import ListingCard from "@/components/ListingCard";
import SelfVideo from "@/components/SelfVideo";

/**
 * Rendered per request, not at build time. Box & Dice rate-limits builds into
 * failure (2 Sep 2026), and a page that can't be built blocks every unrelated
 * deploy. The listings fetch itself is still cached for LISTINGS_REVALIDATE_
 * SECONDS in the data cache, so this costs at most one API call per 10 minutes
 * — the same as the ISR it replaces.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const listings = await getListings();
  /**
   * Three live properties, dearest first.
   *
   * Sorted on the CRM's price guide (Listing.priceValue), never on the display
   * string — "Auction" and "Contact Agent" carry no number, and those sort last
   * rather than jumping the queue on a parse that happened to return zero.
   */
  const featured = listings
    .filter((l) => l.status !== "sold")
    .sort((a, b) => (b.priceValue ?? 0) - (a.priceValue ?? 0))
    .slice(0, 3);

  return (
    <>
      {/* HERO */}
      <section className="hero" style={{ padding: 0 }}>
        <div className="hero-bg">
          <Image
            src="/brand/hero.jpg"
            alt="Modern white architectural home against a clear blue sky"
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
        </div>
        <div className="wrap hero-content">
          <h1>it&rsquo;s time to move</h1>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about">
        <div className="wrap intro-grid">
          <div>
            <h2 className="lead">Authentic is back.</h2>
            <p>My name is Michael Loutakis, founder of Loutakis Real Estate and I am a small piece of the vibrant community in the Inner West. With a reputation for soulful, deeply personal service, I&rsquo;m not here to simply transact&mdash;I&rsquo;m here to connect, guide, and deliver life-changing outcomes for every client I meet.</p>
            <p>Every property journey holds a unique story, and I treat each moment with the care and commitment it deserves. To me, it&rsquo;s never &lsquo;just another listing&rsquo; &mdash; it&rsquo;s someone&rsquo;s future, someone&rsquo;s dreams, someone&rsquo;s next chapter&mdash;and I&rsquo;m deeply honoured to be a part of one&rsquo;s story.</p>
            <a href="/contact" className="btn" style={{ marginTop: 28 }}>Join the movement</a>
          </div>
          {/* Our own file, not YouTube: the master graded at full quality. */}
          <SelfVideo
            src="/video/launch.mp4"
            srcSmall="/video/launch-720.mp4"
            poster="/video/launch-poster.jpg"
            ambient
            label="Loutakis Real Estate"
          />
        </div>
      </section>

      {/* FEATURED PROPERTIES */}
      <section>
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="eyebrow">Properties</div>
              <h2>Featured properties</h2>
            </div>
          </div>
          <div className="grid" style={{ marginTop: 44 }}>
            {featured.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
          <div style={{ marginTop: 44, textAlign: "center" }}>
            <Link href="/properties" className="btn">View all</Link>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="services" style={{ textAlign: "center" }}>
        <div className="wrap">
          <div className="eyebrow" style={{ textAlign: "center" }}>Get in touch</div>
          <h2 className="lead" style={{ margin: "0 auto 30px" }}>Thinking of making a move?<br />Let&apos;s talk.</h2>
          <Link href="/contact" className="btn">Request an appraisal</Link>
        </div>
      </section>
    </>
  );
}
