// Normalised, UI-facing shape. The rest of the app depends ONLY on this,
// never on Box & Dice's raw field names — so the CRM payload can change
// without breaking the site.

export type ListingStatus =
  | "current"
  | "under_offer"
  | "sold"
  | "leased";

export type ListingCategory =
  | "residential"
  | "commercial"
  | "rural"
  | "land"
  | "rental";

export interface Agent {
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  photo?: string;
}

export interface Listing {
  id: string;
  slug: string;
  status: ListingStatus;
  category: ListingCategory;
  headline: string;
  address: {
    street: string;
    suburb: string;
    state: string;
    postcode: string;
  };
  priceDisplay: string;
  /**
   * A number to SORT by — never to show.
   *
   * priceDisplay is the only price a visitor may see: it is what the agent
   * entered and what the underquoting rules are written against. This is the
   * top of the CRM's price guide, used for ordering alone. Rendering it would
   * publish a figure nobody approved for advertising.
   */
  priceValue?: number;
  bed: number;
  bath: number;
  car: number;
  /**
   * "House", "Townhouse", "Apartment" — the CRM's property category, resolved
   * from `property_category_id` against the categories collection. Distinct
   * from `category` above, which is the broad residential/commercial split.
   *
   * Optional because the id can be missing or unknown to us, and a wrong type
   * on a listing is worse than none.
   */
  propertyType?: string;
  landSize?: string;
  description: string;
  features: string[];
  /**
   * `w`/`h` are the photograph's real pixel dimensions, read from the file on
   * the server (lib/image-meta). The CRM does not supply them, and without them
   * the gallery cannot be laid out until the browser has downloaded every photo
   * — which is what made a cold load overlap the page. Optional because a
   * measurement can fail; the gallery falls back to measuring that one itself.
   */
  images: { url: string; alt: string; w?: number; h?: number }[];
  agents: Agent[];
  inspections?: { start: string; end: string }[];
  auctionAt?: string;
  geo?: { lat: number; lng: number };
  documents?: { name: string; url: string }[];
  soiUrl?: string;
  videoUrl?: string;
  updatedAt: string;
}

export const STATUS_LABEL: Record<ListingStatus, string> = {
  current: "Current",
  under_offer: "Under Offer",
  sold: "Sold",
  leased: "Leased",
};
