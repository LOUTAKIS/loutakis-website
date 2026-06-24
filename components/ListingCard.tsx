import Link from "next/link";
import Image from "next/image";
import { Listing } from "@/lib/types";

export default function ListingCard({ listing }: { listing: Listing }) {
  const img = listing.images[0]?.url;
  return (
    <Link href={`/properties/${listing.slug}`} className="card">
      <div className="ph">
        {img && (
          <Image
            src={img}
            alt={listing.images[0]?.alt ?? listing.headline}
            width={800}
            height={600}
            sizes="(max-width: 620px) 100vw, (max-width: 980px) 50vw, 33vw"
          />
        )}
        <div className="hover-cta"><span>It&rsquo;s time to move.</span></div>
      </div>
      <h3>{listing.address.street}, {listing.address.suburb}</h3>
      <div className="meta-row">
        <span>{listing.bed} Bed</span>
        <span>{listing.bath} Bath</span>
        <span>{listing.car} Car</span>
      </div>
      {listing.status === "under_offer" ? (
        <div className="status-line">Under Offer</div>
      ) : (
        <div className="price">{listing.priceDisplay}</div>
      )}
    </Link>
  );
}
