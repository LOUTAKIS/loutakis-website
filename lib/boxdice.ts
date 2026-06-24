import "server-only";
import { Listing, ListingStatus, ListingCategory, Agent } from "./types";
import { MOCK_LISTINGS } from "./mock-data";

/**
 * Box & Dice (MRI) — Website API client.
 * Docs: https://websiteboxdiceapi.docs.apiary.io/
 * ---------------------------------------------------------------------------
 * Auth:        Authorization: Api-Key token=<token>   (generated per office
 *              group in the CRM). Sent on every request. Server-side only.
 * Pagination:  timestamp-based. Call the collection with no args, receive a
 *              batch + a `next` URL; follow `next` until 204 No Content.
 * Endpoints:   GET /sales_listings, GET /consultants, POST /enquiries
 *
 * Set BOXDICE_API_BASE to the exact base URL Box & Dice give you with the key.
 * Until BOXDICE_API_KEY is set (or USE_MOCK_DATA=true) this returns the
 * bundled sample listings so the site is fully browsable offline.
 */

const API_KEY = process.env.BOXDICE_API_KEY;
const API_BASE = (process.env.BOXDICE_API_BASE ?? "https://api.boxdice.com.au/website/v1").replace(/\/$/, "");
const REVALIDATE = Number(process.env.LISTINGS_REVALIDATE_SECONDS ?? 600);
const USE_MOCK = process.env.USE_MOCK_DATA === "true" || !API_KEY;
const MAX_PAGES = 50;

function authHeaders() {
  return { Authorization: `Api-Key token=${API_KEY}`, Accept: "application/json" };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Pull the records array out of a paginated response body, defensively. */
function extractRecords(json: any, keyHint?: string): any[] {
  if (Array.isArray(json)) return json;
  if (keyHint && Array.isArray(json?.[keyHint])) return json[keyHint];
  for (const k of ["sales_listings", "rental_listings", "consultants", "data", "results", "records"]) {
    if (Array.isArray(json?.[k])) return json[k];
  }
  // fall back to the first array-valued property
  for (const v of Object.values(json ?? {})) if (Array.isArray(v)) return v as any[];
  return [];
}

/** Follow the timestamp-paginated collection until 204 / no `next`. */
async function paginate(path: string, recordKey: string): Promise<any[]> {
  let url: string | null = `${API_BASE}${path}`;
  const all: any[] = [];
  for (let i = 0; i < MAX_PAGES && url; i++) {
    const res: Response = await fetch(url, {
      headers: authHeaders(),
      next: { revalidate: REVALIDATE, tags: ["listings"] },
    });
    if (res.status === 204) break; // caught up
    if (!res.ok) throw new Error(`Box & Dice ${path} -> ${res.status} ${res.statusText}`);
    const json: any = await res.json();
    const batch = extractRecords(json, recordKey);
    if (batch.length === 0) break;
    all.push(...batch);
    url = typeof json?.next === "string" ? json.next : null;
  }
  return all;
}

/** The agent-controlled "My Website Status" field, lowercased. */
function websiteStatus(raw: any): string {
  return String(raw.website_status ?? "").toLowerCase().trim();
}

/**
 * A listing appears on the website ONLY when its "My Website Status" is set to
 * "Current" or "Sold" — exactly the dropdown values in Box & Dice. Anything set
 * to "Hidden", or left unset ("Choose…"), is excluded. This mirrors how the
 * portal feeds respect Portal Status.
 */
function isWebsiteVisible(raw: any): boolean {
  if (raw.hidden === true) return false;
  const ws = websiteStatus(raw);
  return ws === "current" || ws === "sold";
}

/** Map "My Website Status" to our UI status. */
function mapStatus(raw: any): ListingStatus {
  const ws = websiteStatus(raw);
  if (ws.includes("sold")) return "sold";
  if (ws.includes("leased")) return "leased";
  if (ws.includes("under") || ws.includes("offer") || ws.includes("conditional") || raw.under_offer === true)
    return "under_offer";
  return "current";
}

function mapCategory(raw: any): ListingCategory {
  if (raw.commercial_listing_type) return "commercial";
  const c = String(raw.property?.commercial_listing_type ?? "").toLowerCase();
  if (c) return "commercial";
  return "residential";
}

function buildStreet(p: any): string {
  return [p?.unit ? `${p.unit}/` : "", p?.number, p?.street_name, p?.street_type]
    .filter(Boolean)
    .join(" ")
    .replace(" /", "/")
    .trim();
}

function normalise(raw: any, consultants: Map<number, Agent>): Listing {
  const p = raw.property ?? {};
  const street = buildStreet(p);
  const suburb = p.suburb ?? "";
  // Keep Box & Dice's own image order (the arrangement set in the CRM).
  const images = (raw.images ?? [])
    .map((img: any) => ({ url: img.url, alt: `${street}, ${suburb}` }))
    .filter((i: any) => i.url);

  const agentIds: number[] = raw.consultant_ids ?? (raw.primary_consultant_id ? [raw.primary_consultant_id] : []);
  const agents = agentIds.map((id) => consultants.get(id)).filter(Boolean) as Agent[];

  return {
    id: String(raw.id),
    slug: slugify(`${street} ${suburb}`) || String(raw.id),
    status: mapStatus(raw),
    category: mapCategory(raw),
    headline: raw.advertising_copy?.heading ?? `${street}, ${suburb}`,
    address: {
      street,
      suburb,
      state: p.state ?? "VIC",
      postcode: p.postcode ?? "",
    },
    priceDisplay: raw.display_price ?? "Contact Agent",
    bed: Number(p.beds ?? 0),
    bath: Number(p.baths ?? 0),
    car: Number(p.cars ?? p.garages ?? 0),
    landSize: p.land_size ? `${p.land_size}${p.land_measure ?? ""}` : undefined,
    description: raw.advertising_copy?.text ?? raw.description ?? "",
    features: p.property_features ?? [],
    images,
    agents,
    inspections: (raw.inspections ?? []).map((i: any) => ({
      start: `${i.inspection_date ?? ""}T${i.start_time ?? "00:00"}`,
      end: `${i.inspection_date ?? ""}T${i.end_time ?? "00:00"}`,
    })),
    geo: p.latitude && p.longitude ? { lat: Number(p.latitude), lng: Number(p.longitude) } : undefined,
    // public/website-tagged files + Statement of Information (read-only)
    documents: [
      ...(raw.soi_file ? [{ name: "Statement of Information", url: String(raw.soi_file) }] : []),
      ...(raw.public_files ?? []).map((f: any) => ({ name: f.name ?? f.description ?? "Document", url: f.url })),
    ].filter((d: any) => d.url),
    updatedAt: raw.sale_date ?? raw.date_listed ?? new Date().toISOString(),
  };
}

async function getConsultants(): Promise<Map<number, Agent>> {
  const map = new Map<number, Agent>();
  try {
    const list = await paginate("/consultants", "consultants");
    for (const c of list) {
      map.set(Number(c.id), {
        name: [c.first_name, c.last_name].filter(Boolean).join(" "),
        title: c.position,
        phone: c.mobile ?? c.phone_bh,
        email: c.email,
        photo: c.avatar_url ?? c.staff_image_url,
      });
    }
  } catch (e) {
    console.error("[boxdice] consultants fetch failed:", e);
  }
  return map;
}

export async function getListings(): Promise<Listing[]> {
  if (USE_MOCK) return MOCK_LISTINGS;
  try {
    const consultants = await getConsultants();
    const raw = await paginate("/sales_listings", "sales_listings");
    const listings = raw
      // show only what the agent has published via "My Website Status"
      .filter(isWebsiteVisible)
      .map((r) => normalise(r, consultants));
    // de-dupe (pagination can return an updated record again) + newest first
    const byId = new Map(listings.map((l) => [l.id, l]));
    return [...byId.values()].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
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
 * READ-ONLY MODE — this site NEVER writes to Box & Dice.
 * This function intentionally does NOT call the Box & Dice API. Enquiries are
 * handled by the website by email (see components/EnquiryForm.tsx), so no
 * record is ever created, updated, or deleted in the CRM.
 *
 * The entire client above uses GET requests only (sales_listings, consultants).
 * There are no POST/PUT/PATCH/DELETE calls to Box & Dice anywhere.
 */
export async function submitEnquiry(input: {
  name: string;
  email: string;
  phone?: string;
  message: string;
  listingId?: string;
  consultantId?: string;
}): Promise<{ ok: boolean }> {
  console.log("[boxdice] enquiry received (NOT sent to CRM — read-only mode):", input);
  return { ok: true };
}
