import { Listing } from "./types";

// Sample listings used until a real Box & Dice API key is configured.
// Shape matches exactly what lib/boxdice.ts returns after normalisation,
// so swapping to the live API requires no UI changes.

const AGENT = {
  name: "Michael Loutakis",
  title: "Director · Auctioneer",
  phone: "+61 409 438 025",
  email: "michael@loutakis.com.au",
  photo:
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
};

export const MOCK_LISTINGS: Listing[] = [
  {
    id: "1",
    slug: "64-mountain-street-south-melbourne",
    status: "current",
    category: "residential",
    headline: "Period charm meets contemporary comfort",
    address: { street: "64 Mountain Street", suburb: "South Melbourne", state: "VIC", postcode: "3205" },
    priceDisplay: "$1,200,000 – $1,300,000",
    bed: 4, bath: 1, car: 2, landSize: "372m²",
    description:
      "A beautifully presented family residence blending period charm with contemporary comfort, footsteps from cafés, parks and transport. Light-filled living zones flow to a private north-facing garden — a rare offering in one of the area's most tightly held pockets.",
    features: ["Original period features", "North-facing garden", "Off-street parking for two", "Walk to transport"],
    images: [
      { url: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1400&q=80", alt: "Facade" },
      { url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=80", alt: "Living room" },
      { url: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1400&q=80", alt: "Kitchen" },
    ],
    agents: [AGENT],
    inspections: [{ start: "2026-07-04T11:00:00+10:00", end: "2026-07-04T11:30:00+10:00" }],
    updatedAt: "2026-06-21T09:00:00+10:00",
  },
  {
    id: "2",
    slug: "151-hudsons-road-spotswood",
    status: "current",
    category: "residential",
    headline: "Substantial family home with rare four-car accommodation",
    address: { street: "151 Hudsons Road", suburb: "Spotswood", state: "VIC", postcode: "3015" },
    priceDisplay: "Auction Saturday 12 July",
    bed: 5, bath: 2, car: 4, landSize: "548m²",
    description:
      "Substantial five-bedroom home with flexible living zones, a north-facing garden and rare four-car accommodation. Ideal for growing families seeking space, light and proximity to the village.",
    features: ["Five bedrooms", "Two living zones", "Four-car accommodation", "548m² allotment"],
    images: [
      { url: "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=1400&q=80", alt: "Facade" },
      { url: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?auto=format&fit=crop&w=1400&q=80", alt: "Interior" },
    ],
    agents: [AGENT],
    inspections: [{ start: "2026-07-05T10:00:00+10:00", end: "2026-07-05T10:30:00+10:00" }],
    updatedAt: "2026-06-20T14:00:00+10:00",
  },
  {
    id: "3",
    slug: "106-eleanor-street-footscray",
    status: "current",
    category: "residential",
    headline: "Stylish single-fronter in vibrant Footscray",
    address: { street: "106 Eleanor Street", suburb: "Footscray", state: "VIC", postcode: "3011" },
    priceDisplay: "$890,000",
    bed: 2, bath: 1, car: 2, landSize: "248m²",
    description:
      "A stylish single-fronter with a sun-drenched courtyard, perfectly positioned in the heart of vibrant Footscray. Move-in ready with quality finishes throughout.",
    features: ["Sun-drenched courtyard", "Renovated kitchen", "Two-car parking", "Walk to station"],
    images: [
      { url: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1400&q=80", alt: "Facade" },
      { url: "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80", alt: "Kitchen" },
    ],
    agents: [AGENT],
    updatedAt: "2026-06-19T11:00:00+10:00",
  },
  {
    id: "4",
    slug: "40-herbert-street-footscray",
    status: "under_offer",
    category: "residential",
    headline: "Renovated Victorian with soaring ceilings",
    address: { street: "40 Herbert Street", suburb: "Footscray", state: "VIC", postcode: "3011" },
    priceDisplay: "Under Offer",
    bed: 3, bath: 1, car: 1, landSize: "301m²",
    description:
      "Renovated Victorian with soaring ceilings and original features, now under offer after a strong campaign. A benchmark result for the street.",
    features: ["Soaring ceilings", "Original features", "Renovated throughout"],
    images: [
      { url: "https://images.unsplash.com/photo-1576941089067-2de3c901e126?auto=format&fit=crop&w=1400&q=80", alt: "Facade" },
    ],
    agents: [AGENT],
    updatedAt: "2026-06-18T16:00:00+10:00",
  },
  {
    id: "5",
    slug: "68-blackshaws-road-south-kingsville",
    status: "current",
    category: "residential",
    headline: "Solid brick home with scope to add value",
    address: { street: "68 Blackshaws Road", suburb: "South Kingsville", state: "VIC", postcode: "3015" },
    priceDisplay: "Contact Agent",
    bed: 3, bath: 1, car: 2, landSize: "410m²",
    description:
      "Solid brick family home on a generous allotment with scope to renovate or rebuild (STCA) in a tightly held pocket. A genuine opportunity for buyers and investors alike.",
    features: ["410m² allotment", "Scope to renovate (STCA)", "Two-car parking"],
    images: [
      { url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1400&q=80", alt: "Facade" },
    ],
    agents: [AGENT],
    updatedAt: "2026-06-17T10:00:00+10:00",
  },
  {
    id: "6",
    slug: "12-argyle-street-williamstown",
    status: "sold",
    category: "residential",
    headline: "Elegant weatherboard moments from the beach",
    address: { street: "12 Argyle Street", suburb: "Williamstown", state: "VIC", postcode: "3016" },
    priceDisplay: "Sold · $1,615,000",
    bed: 4, bath: 2, car: 2, landSize: "520m²",
    description:
      "Elegant weatherboard moments from the beach, sold above reserve under the hammer following a competitive auction campaign.",
    features: ["Beachside location", "Sold above reserve", "520m² allotment"],
    images: [
      { url: "https://images.unsplash.com/photo-1592595896551-12b371d546d5?auto=format&fit=crop&w=1400&q=80", alt: "Facade" },
    ],
    agents: [AGENT],
    updatedAt: "2026-06-10T18:00:00+10:00",
  },
];
