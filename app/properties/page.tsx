import Link from "next/link";
import { getListings } from "@/lib/boxdice";
import PropertyFilters from "@/components/PropertyFilters";

export const revalidate = 600;

export const metadata = {
  title: "Properties — Loutakis Real Estate",
  description: "Current listings and recent sales across Melbourne's Inner West.",
};

export default async function PropertiesPage() {
  const listings = await getListings();

  return (
    <section className="properties-page">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">Properties</div>
            <h2>Current listings</h2>
          </div>
        </div>
        <PropertyFilters listings={listings} />

        {/* Catches the buyer who has just scrolled everything we advertise. */}
        <aside className="offmarket-card">
          <div>
            <div className="eyebrow">Off-market</div>
            <h3>Not everything we sell is here.</h3>
            <p>Some owners prefer a quiet campaign. Those homes go to a private list.</p>
          </div>
          <Link href="/portal/register" className="btn">Request access</Link>
        </aside>

        {/* Sale of Land Act 1962 (Vic) ss 33B–33C: the due diligence checklist
            must be made available to prospective purchasers of residential land
            from the time the property is offered for sale. */}
        <p className="due-diligence" style={{ marginTop: 48, fontSize: 14, opacity: 0.75 }}>
          Buying a residential property? Consumer Affairs Victoria&rsquo;s{" "}
          <a
            href="https://www.consumer.vic.gov.au/duediligencechecklist"
            target="_blank"
            rel="noopener noreferrer"
          >
            due diligence checklist
          </a>{" "}
          covers the questions worth asking before you sign.
        </p>
      </div>
    </section>
  );
}
