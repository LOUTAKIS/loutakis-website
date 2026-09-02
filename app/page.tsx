import Link from "next/link";
import Image from "next/image";
import { getListings } from "@/lib/boxdice";
import ListingCard from "@/components/ListingCard";
import VideoEmbed from "@/components/VideoEmbed";

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
  const featured = listings.filter((l) => l.status !== "sold").slice(0, 3);

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
          <h1>It&apos;s time<br />to move.</h1>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about">
        <div className="wrap intro-grid">
          <div>
            <h2 className="lead">Authentic is back.</h2>
            <p>My name is Michael Loutakis, founder of Loutakis Real Estate and I am a small piece of the vibrant community in the Inner West. With a reputation for soulful, deeply personal service, I&rsquo;m not here to simply transact&mdash;I&rsquo;m here to connect, guide, and deliver life-changing outcomes for every client I meet.</p>
            <p>Every property journey holds a unique story, and I treat each moment with the care and commitment it deserves. To me, it&rsquo;s never &lsquo;just another listing&rsquo; &mdash; it&rsquo;s someone&rsquo;s future, someone&rsquo;s dreams, someone&rsquo;s next chapter&mdash;and I&rsquo;m deeply honoured to be a part of one&rsquo;s story.</p>
            <a href="https://www.loutakis.com.au/contact" className="btn" style={{ marginTop: 28 }}>Join the movement</a>
          </div>
          <VideoEmbed id="J-nrYPgIgwU" title="Loutakis Real Estate" />
        </div>
      </section>

      {/* FEATURED LISTINGS */}
      <section>
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="eyebrow">Properties</div>
              <h2>Featured listings</h2>
            </div>
          </div>
          <div className="grid" style={{ marginTop: 44 }}>
            {featured.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
          <div style={{ marginTop: 44 }}>
            <Link href="/properties" className="btn">View all properties</Link>
          </div>
        </div>
      </section>

      {/* OFF-MARKET */}
      <section className="offmarket-band">
        <div className="wrap">
          <div className="eyebrow">Off-market</div>
          <h2 className="lead">Some homes sell<br />before they&rsquo;re listed.</h2>
          <p>
            A quiet list, shared with buyers we know. Ask to be on it.
          </p>
          <Link href="/portal/register" className="btn">Request access</Link>
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
