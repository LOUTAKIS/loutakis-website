export const metadata = {
  title: "About — Loutakis Real Estate",
  description:
    "Loutakis Real Estate: dedicated local experts committed to authentic service, community trust, and personalised real estate in Melbourne's Inner West.",
};

export default function AboutPage() {
  return (
    <>
      {/* WHO WE ARE */}
      <section>
        <div className="wrap">
          <div className="eyebrow">About</div>
          <h1 className="lead">Who we are</h1>
          <p style={{ maxWidth: 760, color: "var(--muted)", marginTop: 18 }}>
            We are real estate with soul. Run by a dedicated local with an extremely sharp eye for
            detail, high-impact marketing, and a deep understanding of sales negotiations, we bring a
            fresh, authentic energy to every transaction. It&rsquo;s about elevating the experience,
            building real, raw relationships, and representing your home with precision, pride and
            personality. A passionate professional doing things properly &mdash; and a little
            differently.
          </p>
        </div>
      </section>

      {/* LED BY PASSION */}
      <section className="services">
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
            <a href="https://www.loutakis.com.au/contact" className="btn" style={{ marginTop: 28 }}>
              Speak with Michael
            </a>
          </div>
        </div>
      </section>

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
