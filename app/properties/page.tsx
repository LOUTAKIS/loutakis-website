import { getListings } from "@/lib/boxdice";
import PropertyFilters from "@/components/PropertyFilters";

export const revalidate = 600;

export const metadata = {
  title: "Properties — Harbourview Real Estate",
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
      </div>
    </section>
  );
}
