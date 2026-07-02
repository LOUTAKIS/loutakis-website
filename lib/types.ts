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
  bed: number;
  bath: number;
  car: number;
  landSize?: string;
  description: string;
  features: string[];
  images: { url: string; alt: string }[];
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
