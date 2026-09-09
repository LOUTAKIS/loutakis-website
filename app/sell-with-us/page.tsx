import Image from "next/image";
import { getConsultantOptions, defaultConsultant } from "@/lib/boxdice";
import AppraisalForm from "@/components/AppraisalForm";
import MarketPerformance from "@/components/MarketPerformance";

export const metadata = {
  title: "Sell with us — Loutakis Real Estate",
  description:
    "Residential sales, auctioneering, and honest sale preparation & advice across Melbourne's Inner West.",
};

const SERVICES = [
  {
    title: "Residential Sales",
    image: "/brand/sell/sell-residential.jpg",
    alt: "A living room opening onto a hedged courtyard",
    blurb:
      "Selling your home is a significant moment, and we take it personally. We bring strategy, energy, and the right advice to ensure your property is positioned to achieve the best possible result.",
  },
  {
    title: "Auctioneering",
    image: "/brand/sell/sell-auction.jpg",
    alt: "A double-height living room with a fireplace, opening to the garden",
    blurb:
      "Not all auctioneers are equal. What separates a win from a missed opportunity is often invisible — until it's too late. We read the room, control the pace, and bring confidence under pressure.",
  },
  {
    title: "Sale Prep & Advice",
    image: "/brand/sell/sell-advice.jpg",
    alt: "A kitchen and hallway looking through to the garden beyond",
    blurb:
      "You don't need to be selling right now, or even own a home, to ask questions and get honest answers. We're part of the community, here to help long before any paperwork is signed.",
  },
];

export default async function SellWithUsPage() {
  const consultants = await getConsultantOptions();
  const preferred = defaultConsultant(consultants);
  return (
    <>
      <section>
        <div className="wrap swu-head">
          <h1 className="lead">Sell with us.</h1>
          <p>
            We specialise in selling residential properties with sharp marketing, expert negotiation,
            and a flair for storytelling that genuinely connects buyers to your home. And on auction
            day, we bring clarity, confidence and just the right amount of charisma.
          </p>
          <a href="#start" className="btn">Get started</a>
        </div>
      </section>

      {/* One banner of three, each service written under its own picture. The
          pictures share a row and a shape, so across the top they read as a
          single band; keeping each one in a cell with its own words means a
          phone stacks picture-then-words rather than all three pictures and
          then all three blocks of copy. */}
      <section className="services">
        <div className="wrap sell-grid">
          {SERVICES.map((s) => (
            <div className="sell-col" key={s.title}>
              {/* 2:3 and shown whole — the three share a shape, so their
                  bottom edges line up without anything being cropped. */}
              <Image
                className="sell-photo"
                src={s.image}
                alt={s.alt}
                width={1000}
                height={1500}
                sizes="(max-width: 900px) 100vw, 33vw"
              />
              <h2>{s.title}</h2>
              <p>{s.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The appraisal request. The old "Interested in working together?"
          button pointed at a general contact page; a seller who has read this
          far should be able to start here instead. */}
      {/* Proof, between what we do and the ask: a vendor should see the numbers
          before being invited to fill in nine questions. Computed from the CRM,
          and it hides itself if the CRM is unreachable. */}
      <MarketPerformance />

      <section id="start">
        <div className="wrap swu-form">
          <div className="eyebrow">Get started</div>
          <h2 className="lead">Tell us about your home.</h2>
          <p className="swu-intro">
            A few questions so we arrive knowing something about your home, rather than starting cold.
          </p>
          <AppraisalForm consultants={consultants} defaultConsultantId={preferred?.id ?? null} />
        </div>
      </section>

    </>
  );
}
