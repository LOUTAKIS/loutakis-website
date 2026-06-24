import "server-only";
import { Listing, ListingStatus, ListingCategory } from "./types";
import { MOCK_LISTINGS } from "./mock-data";

/**
 * Box & Dice (MRI) — Website API client.
 * ---------------------------------------------------------------------------
 * Docs: https://websiteboxdiceapi.docs.apiary.io/
 *
 * Auth:   API key sent in the `Authorization` header on every request.
 * Paging: array endpoints are paginated by timestamp (great for incremental
 *         sync — we page until the API returns fewer than `per` records).
 *
 * IMPORTANT: this file imports "server-only", so the secret API key can never
 * be bundled into client-side JavaScript. All calls run on the server.
 *
 * Until BOXDICE_API_KEY is set (and USE_MOCK_DATA=false), the functions below
 * return the bundled mock data so the whole site is fully browsable offline.
 */

const API_KEY = process.env.BOXDICE_API_KEY;
const API_BASE = process.env.BOXDICE_API_BASE ?? "https://api.boxdice.com.au/website/v1";
const OFFICE_ID = process.env.BOXDICE_OFFICE_ID;
const REVALIDATE = Number(process.env.LISTINGS_REVALIDATE_SECONDS ?? 600);

// Use mock data when explicitly requested OR when no key is configured.
const USE_MOCK =
  process.env.USE_MOCK_DATA === "true" || !API_KEY;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Map Box & Dice status fields to our simple union.
 * The CRM exposes per-category status (residential_status, commercial_status,
 * rental_status, etc.). We collapse them to one value for the UI.
 */
function mapStatus(raw: any): ListingStatus {
  const s = String(
    raw.status ??
      raw.residential_status ??
      raw.commercial_status ??
      raw.rental_status ??
      raw.land_status ??
      ""
  ).toLowerCase();

  if (s.includes("sold")) return "sold";
  if (s.includes("leased")) return "leased";
  if (s.includes("under offer") || s.includes("under_offer") || s.includes("conditional"))
    return "under_offer";
  return "current";
}

function mapCategory(raw: any): ListingCategory {
  const c = String(raw.category ?? raw.property_type ?? raw.type ?? "residential").toLowerCase();
  if (c.includes("commercial")) return "commercial";
  if (c.includes("rural")) return "rural";
  if (c.includes("land")) return "land";
  if (c.includes("rent")) return "rental";
  return "residential";
}

/**
 * Convert one raw Box & Dice listing record into our normalised Listing.
 * Field names are defensive: the API's exact keys vary by account/version,
 * so we read several likely aliases. Adjust here after seeing your real data.
 */
function normalise(raw: any): Listing {
  const street =
    raw.address?.street ??
    [raw.street_number, raw.street_name].filter(Boolean).join(" ") ??
    raw.display_address ??
    "";
  const suburb = raw.address?.suburb ?? raw.suburb ?? "";
  const state = raw.address?.state ?? raw.state ?? "VIC";
  const postcode = raw.address?.postcode ?? raw.postcode ?? "";

  const images = (raw.images ?? raw.photos ?? [])
    .map((img: any) => ({
      url: typeof img === "string" ? img : img.url ?? img.href ?? img.large ?? "",
      alt: img.caption ?? `${street}, ${suburb}`,
    }))
    .filter((i: any) => i.url);

  const agents = (raw.agents ?? raw.contacts ?? []).map((a: any) => ({
    name: a.name ?? [a.first_name, a.last_name].filter(Boolean).join(" "),
    title: a.title ?? a.position,
    phone: a.phone ?? a.mobile,
    email: a.email,
    photo: a.photo ?? a.image,
  }));

  const headline = raw.headline ?? raw.heading ?? raw.title ?? `${street}, ${suburb}`;

  return {
    id: String(raw.id ?? raw.listing_id),
    slug: slugify(`${street} ${suburb}`) || String(raw.id),
    status: mapStatus(raw),
    category: mapCategory(raw),
    headline,
    address: { street, suburb, state, postcode },
    priceDisplay: raw.price_display ?? raw.display_price ?? raw.price ?? "Contact Agent",
    bed: Number(raw.bedrooms ?? raw.bed ?? 0),
    bath: Number(raw.bathrooms ?? raw.bath ?? 0),
    car: Number(raw.carspaces ?? raw.car ?? raw.parking ?? 0),
    landSize: raw.land_size ?? raw.land_area,
    description: raw.description ?? raw.advert_body ?? "",
    features: raw.features ?? [],
    images,
    agents,
    inspections: (raw.inspections ?? raw.open_times ?? []).map((i: any) => ({
      start: i.start ?? i.from,
      end: i.end ?? i.to,
    })),
    geo:
      raw.latitude && raw.longitude
        ? { lat: Number(raw.latitude), lng: Number(raw.longitude) }
        : undefined,
    updatedAt: raw.updated_at ?? raw.modified_at ?? new Date().toISOString(),
  };
}

async function apiGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${API_BASE}${path}`);
  if (OFFICE_ID) url.searchParams.set("office_id", OFFICE_ID);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Api-Key ${API_KEY}`,
      Accept: "application/json",
    },
    // ISR: cache the response and refresh in the background every REVALIDATE s.
    next: { revalidate: REVALIDATE, tags: ["listings"] },
  });

  if (!res.ok) {
    throw new Error(`Box & Dice API ${path} → ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Fetch all sales listings, paging through the timestamp-paginated endpoint. */
export async function getListings(): Promise<Listing[]> {
  if (USE_MOCK) return MOCK_LISTINGS;

  try {
    const all: Listing[] = [];
    let after = "0";
    const per = 50;

    // Page until a short page is returned.
    for (let guard = 0; guard < 100; guard++) {
      const page = await apiGet("/listings", { updated_after: after, per: String(per) });
      const records: any[] = Array.isArray(page) ? page : page.listings ?? page.data ?? [];
      if (records.length === 0) break;

      all.push(...records.map(normalise));
      after = String(records[records.length - 1].updated_at ?? records[records.length - 1].id);
      if (records.length < per) break;
    }

    // De-duplicate by id and sort newest first.
    const byId = new Map(all.map((l) => [l.id, l]));
    return [...byId.values()].sort(
      (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)
    );
  } catch (err) {
    console.error("[boxdice] falling back to mock data:", err);
    return MOCK_LISTINGS;
  }
}

export async function getListingBySlug(slug: string): Promise<Listing | null> {
  const listings = await getListings();
  return listings.find((l) => l.slug === slug) ?? null;
}

/**
 * Post an enquiry back to Box & Dice as a lead (Enquiry API).
 * Docs: https://boxdiceenquiryapi.docs.apiary.io/
 */
export async function submitEnquiry(input: {
  name: string;
  email: string;
  phone?: string;
  message: string;
  listingId?: string;
}): Promise<{ ok: boolean }> {
  const base = process.env.BOXDICE_ENQUIRY_API_BASE;
  if (USE_MOCK || !base || !API_KEY) {
    console.log("[boxdice] (mock) enquiry received:", input);
    return { ok: true };
  }

  const res = await fetch(`${base}/enquiries`, {
    method: "POST",
    headers: {
      Authorization: `Api-Key ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      office_id: OFFICE_ID,
      listing_id: input.listingId,
      contact: { name: input.name, email: input.email, phone: input.phone },
      message: input.message,
      source: "website",
    }),
  });

  return { ok: res.ok };
}
