import Link from "next/link";

export const metadata = {
  title: "Services — Loutakis Real Estate",
  description:
    "Residential sales, auctioneering, and honest sale preparation & advice across Melbourne's Inner West.",
};

const SERVICES = [
  {
    n: "01",
    title: "Residential Sales",
    blurb:
      "Selling your home is a significant moment, and we take it personally. We bring strategy, energy, and the right advice to ensure your property is positioned to achieve the best possible result.",
    points: [
      "Tailored campaign strategy that reflects your goals and market conditions",
      "Trusted advice on presentation, pricing, and timing",
      "Professional photography, copywriting, and marketing to stand out",
      "Transparent communication every step of the way",
      "Skilled negotiation to extract the strongest outcome from every buyer",
    ],
    foot: "We don't just list homes, we represent them with purpose, care, and ambition.",
  },
  {
    n: "02",
    title: "Auctioneering",
    blurb:
      "Not all auctioneers are equal. What separates a win from a missed opportunity is often invisible — until it's too late. We read the room, control the pace, and bring confidence under pressure.",
    points: [
      "Set the right tone and energy on auction day",
      "Adapt style to suit buyer comfort and crowd dynamics",
      "Leverage emotion and competition to maximise outcomes",
      "Work seamlessly with vendors in pre-auction strategy",
      "Maintain poise and control to protect your bottom line",
    ],
    foot: "When it matters most, we know how to hold the room — and when to let it go.",
  },
  {
    n: "03",
    title: "Sale Prep & Advice",
    blurb:
      "You don't need to be selling right now, or even own a home, to ask questions and get honest answers. We're part of the community, here to help long before any paperwork is signed.",
    points: [
      "Confidential consultations without pressure or obligation",
      "Help you understand the market, even years before a sale",
      "Styling and improvement advice to boost future value",
      "A long-term game plan tailored to your goals",
      "Always available for a chat, a coffee, or just some clarity",
    ],
    foot: "Whatever stage you're at, let's talk. We're here when you're ready, no rush.",
  },
];

export default function ServicesPage() {
  return (
    <>
      <section>
        <div className="wrap">
          <div className="eyebrow">Our services</div>
          <h1 className="lead">Selling with precision, creativity, and a whole lot of heart.</h1>
          <p style={{ maxWidth: 760, color: "var(--muted)", marginTop: 18 }}>
            We specialise in selling residential properties with sharp marketing, expert negotiation,
            and a flair for storytelling that genuinely connects buyers to your home. And on auction
            day, we bring clarity, confidence and just the right amount of charisma.
          </p>
        </div>
      </section>

      {SERVICES.map((s, i) => (
        <section key={s.n} className={i % 2 === 0 ? "services" : undefined}>
          <div className="wrap intro-grid">
            <div className={`img-ph${i % 2 === 1 ? " order-last" : ""}`} aria-label="Image placeholder">
              <span>Image placeholder</span>
            </div>
            <div>
              <div className="eyebrow">{s.n}</div>
              <h2 className="lead">{s.title}</h2>
              <p style={{ color: "var(--muted)" }}>{s.blurb}</p>
              <ul className="features-list" style={{ columns: 1, marginTop: 18 }}>
                {s.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <p style={{ marginTop: 16 }}>{s.foot}</p>
            </div>
          </div>
        </section>
      ))}

      <section style={{ textAlign: "center" }} className="services">
        <div className="wrap">
          <div className="eyebrow" style={{ textAlign: "center" }}>Get in touch</div>
          <h2 className="lead" style={{ margin: "0 auto 24px" }}>Interested in working together?</h2>
          <Link href="/contact" className="btn">Contact us</Link>
        </div>
      </section>
    </>
  );
}
