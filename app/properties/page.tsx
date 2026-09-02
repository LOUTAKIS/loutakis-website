import Link from "next/link";
import { getListings } from "@/lib/boxdice";
import PropertyFilters from "@/components/PropertyFilters";

// Per request, not at build — see the note in app/page.tsx. The underlying
// CRM fetch is still cached, so this doesn't add API traffic.
export const dynamic = "force-dynamic";

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

        {/* Sale of Land Act 1962 (Vic) ss 33B–33C — the due diligence checklist
            must be available to prospective purchasers from the time the land is
            offered for sale. Removed from this page by request; the obligation is
            still met by the permanent link in the site footer. Don't remove both. */}
      </div>
    </section>
  );
}
