/**
 * Rendered per request, for one reason: the Instagram token.
 *
 * `revalidate` was the obvious choice and it was wrong. An ISR page is built
 * during the deploy, and INSTAGRAM_TOKEN is not available to a build — so the
 * row rendered empty, that empty HTML was what every visitor got, and the empty
 * result was written into the shared feed cache on the way past. Redeploying
 * repeated it; purging the cache did not help, because the next regeneration
 * read the same emptiness straight back in.
 *
 * A page that shows live data from a runtime-only secret cannot be built ahead
 * of time. The feed itself is still cached for an hour inside getInstagramPosts,
 * so this costs a render, not an Instagram call.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "About — Loutakis Real Estate",
  description:
    "Loutakis Real Estate: dedicated local experts committed to authentic service, community trust, and personalised real estate in Melbourne's Inner West.",
};

import SelfVideo from "@/components/SelfVideo";
import InstagramRow from "@/components/InstagramRow";

export default function AboutPage() {
  return (
    <>
      {/* TRUST, NOT TRANSACTIONS — the section from loutakis.com.au: the words
          on the left, the testimonial beside them on the right, never stacked. */}
      <section>
        <div className="wrap">
          <div className="trust-grid">
            <div>
              <div className="eyebrow">About</div>
              <h1 className="lead">Real Estate built on trust, not transactions.</h1>
              <p style={{ color: "var(--muted)", maxWidth: "40ch", marginTop: 20 }}>
                Hear from the locals who have trusted Michael to guide them through some of
                life&rsquo;s biggest moments.
              </p>
              <a href="/contact" className="btn" style={{ marginTop: 28 }}>
                Feel the movement
              </a>
            </div>
            <SelfVideo
              src="/video/testimonial-fourth-ave.mp4"
              srcSmall="/video/testimonial-fourth-ave-720.mp4"
              poster="/video/testimonial-fourth-ave-poster.jpg"
              label="A testimonial from 29 Fourth Avenue"
              /* Runs on its own, muted and looping, like the launch film —
                 one tap brings the voices in. */
              ambient
              className="sv-portrait"
            />
          </div>
        </div>
      </section>

      {/* LED BY PASSION */}
      <section className="services about-story">
        <div className="wrap intro-grid">
          <div className="portrait">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/michael.jpg" alt="Michael Loutakis" />
          </div>
          <div>
            <div className="eyebrow">Led by passion &amp; authenticity</div>
            <h2 className="lead">Real estate was never just a job.</h2>
            <p>
              For Michael Loutakis, real estate was never just a job &mdash; it&rsquo;s part of who he
              is. Raised in Melbourne&rsquo;s Inner West, in a community built on hard work and trust,
              Michael grew up understanding that a home isn&rsquo;t just four walls &mdash; it&rsquo;s
              where decade-long stories begin.
            </p>
            <p>
              Having been proudly connected to Newport, Williamstown, and the surrounding suburbs his
              whole life, locals know him not just as an agent, but as a neighbour &mdash; someone who
              genuinely cares. Michael believes real estate is about people first: listening, showing
              up, and doing the right thing, every time.
            </p>
            <p>
              Starting Loutakis Real Estate is his way of giving back to the place that shaped him.
              It&rsquo;s a hands-on, heart-in business, built on trust, backed by local knowledge, and
              run with integrity.
            </p>
            <p>
              <strong>Welcome to Loutakis Real Estate. Local. Honest. Invested in people.</strong>
            </p>
            <a href="/contact" className="btn" style={{ marginTop: 28 }}>
              Speak with Michael
            </a>
          </div>
        </div>
      </section>

      {/* Live from Instagram, below Michael's story. Renders nothing when the
          feed is unavailable, so the page never shows a broken row. */}
      <InstagramRow />

      {/* CONTACT TEASER */}
      <section style={{ textAlign: "center" }}>
        <div className="wrap">
          <div className="eyebrow" style={{ textAlign: "center" }}>Get in touch</div>
          <h2 className="lead" style={{ margin: "0 auto 24px" }}>Contact us</h2>
          <p style={{ maxWidth: 560, margin: "0 auto 30px", color: "var(--muted)" }}>
            Whether you&rsquo;re buying, selling or just wanting to know more about the community you
            could call home.
          </p>
          <a href="mailto:michael@loutakis.com.au?subject=Website%20Enquiry" className="btn">
            Get in touch
          </a>
        </div>
      </section>
    </>
  );
}
