import "server-only";
import { unstable_cache } from "next/cache";
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
const API_BASE = (process.env.BOXDICE_API_BASE ?? "https://loutakis.boxdice.com.au/website_api").replace(/\/$/, "");
const REVALIDATE = Number(process.env.LISTINGS_REVALIDATE_SECONDS ?? 600);
/**
 * Sample listings are a LOCAL DEVELOPMENT convenience only — never production.
 * `USE_MOCK_DATA` has sat in Vercel Production since June 2026 with a sealed
 * value; if it were ever "true" the public site would advertise six invented
 * properties. The environment check disarms that permanently.
 */
const USE_MOCK =
  process.env.NODE_ENV !== "production" &&
  (process.env.USE_MOCK_DATA === "true" || !API_KEY);
const MAX_PAGES = 50;
const MAX_RETRIES = 5;            // attempts after the first 429 before giving up
const MAX_RETRY_WAIT_MS = 8_000;  // never sleep longer than this, whatever the header says
/**
 * Total time this request may spend waiting out 429s before it gives up.
 * Nobody waits 40 seconds for a web page: past this, failing fast and serving
 * the cached page (or the error boundary) beats holding the visitor hostage.
 */
const RETRY_BUDGET_MS = 12_000;
const REQUEST_TIMEOUT_MS = 10_000;

function authHeaders() {
  return { Authorization: `Api-Key token=${API_KEY}`, Accept: "application/json" };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** "SOUTH MELBOURNE" -> "South Melbourne" (Box & Dice returns suburbs in caps). */
function titleCase(s: string): string {
  return String(s ?? "").toLowerCase().replace(/\b[a-z]/g, (m) => m.toUpperCase());
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * How long to wait after a 429. Box & Dice send `Retry-After`, which per spec
 * is either a number of seconds or an HTTP date. Handle both, fall back to 1s
 * if missing or unparseable, and never wait absurdly long.
 */
function retryAfterMs(res: Response): number {
  const header = res.headers.get("retry-after");
  if (!header) return 1000;

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_WAIT_MS);
  }

  const until = Date.parse(header);
  if (!Number.isNaN(until)) {
    return Math.min(Math.max(until - Date.now(), 0), MAX_RETRY_WAIT_MS);
  }

  return 1000;
}

/**
 * One page fetch, with 429 handling.
 *
 * Every attempt uses the same cache options. Next.js only writes 200 responses
 * to its data cache, so a 429 is never replayed — and switching retries to
 * `no-store` (an earlier version did) throws DYNAMIC_SERVER_USAGE inside
 * statically generated pages, which turned every rate-limited build into a
 * mock-data build.
 */
async function fetchPage(url: string, noStore = false): Promise<Response> {
  const cacheOpts = noStore
    ? { cache: "no-store" as RequestCache }
    : { next: { revalidate: REVALIDATE, tags: ["listings"] } };
  let waited = 0;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res: Response = await fetch(url, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...cacheOpts,
    });

    if (res.status !== 429) return res;

    if (attempt === MAX_RETRIES) {
      console.error(`[boxdice] still rate limited after ${MAX_RETRIES} retries: ${url}`);
      return res; // let the caller throw with the 429 in the message
    }

    const wait = retryAfterMs(res);
    if (waited + wait > RETRY_BUDGET_MS) {
      console.error(
        `[boxdice] 429 and out of retry budget after ${waited}ms — giving up: ${url}`
      );
      return res;
    }
    console.warn(
      `[boxdice] 429 rate limited, waiting ${wait}ms then retrying ` +
        `(attempt ${attempt + 1}/${MAX_RETRIES}): ${url}`
    );
    await sleep(wait);
    waited += wait;
  }

  throw new Error("[boxdice] fetchPage exhausted retries unexpectedly");
}

/**
 * Follow the timestamp-paginated collection until 204 / no `next`.
 *
 * Concurrent callers for the same collection share one in-flight request.
 * `next build` renders every property page at once and each one asks for the
 * same two collections; without this they all miss the data cache together
 * and Box & Dice rate-limits the whole build into mock data.
 */
const inflight = new Map<string, Promise<any[]>>();

function paginate(path: string, recordKey: string, noStore = false): Promise<any[]> {
  const key = `${path}|${noStore ? "live" : "cached"}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = paginateUncached(path, recordKey, noStore).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function paginateUncached(path: string, recordKey: string, noStore: boolean): Promise<any[]> {
  let url: string | null = `${API_BASE}${path}`;
  const all: any[] = [];
  for (let i = 0; i < MAX_PAGES && url; i++) {
    const res: Response = await fetchPage(url, noStore);
    if (res.status === 204) break; // caught up
    if (!res.ok) throw new Error(`Box & Dice ${path} -> ${res.status} ${res.statusText}`);
    const json: any = await res.json();
    const batch = extractRecords(json, recordKey);
    if (batch.length === 0) break;
    all.push(...batch);
    // The documented envelope is { data: [...], paging: { next } }. Reading a
    // top-level `next` finds nothing, so the loop used to stop after page one —
    // harmless while everything fits in a single page, silently lossy after that.
    url =
      (typeof json?.paging?.next === "string" && json.paging.next) ||
      (typeof json?.next === "string" && json.next) ||
      null;
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
  const suburb = titleCase(p.suburb ?? "");
  // Box & Dice image ordering by the `index` label:
  //   "MAIN"        = hero photo (show first)
  //   "A".."Z"      = gallery photos, alphabetical order
  //   "FLOORPLAN_n" = floorplans (show last, never the hero)
  const rawImages = (raw.images ?? []).filter((i: any) => i?.url);
  const idx = (i: any) => String(i.index ?? "").toUpperCase();
  const main = rawImages.filter((i: any) => idx(i) === "MAIN");
  const floorplans = rawImages.filter((i: any) => idx(i).startsWith("FLOORPLAN"));
  const gallery = rawImages
    .filter((i: any) => idx(i) !== "MAIN" && !idx(i).startsWith("FLOORPLAN"))
    .sort((a: any, b: any) => idx(a).localeCompare(idx(b), undefined, { numeric: true }));
  const images = [...main, ...gallery, ...floorplans].map((img: any) => ({
    url: img.url,
    alt: `${street}, ${suburb}`,
  }));

  const agentIds: number[] = raw.consultant_ids ?? (raw.primary_consultant_id ? [raw.primary_consultant_id] : []);
  const agents = agentIds.map((id) => consultants.get(id)).filter(Boolean) as Agent[];

  // SOI is identified by file TYPE via the dedicated `soi_file` field
  // (falls back to a website file whose name/type says Statement of Information).
  const publicFiles = (raw.public_files ?? []).filter((f: any) => f.url);
  const soiUrl: string | undefined =
    (raw.soi_file ? String(raw.soi_file) : undefined) ??
    publicFiles.find((f: any) =>
      /statement of information|\bsoi\b/i.test(`${f.name ?? ""} ${f.description ?? ""}`)
    )?.url;
  // Other website-tagged documents (excluding the SOI, which has its own button).
  const documents = publicFiles
    .filter((f: any) => f.url !== soiUrl)
    .map((f: any) => ({ name: f.name ?? f.description ?? "Document", url: f.url }));

  // Price: sold listings show the actual SALE price (respecting "price undisclosed");
  // current/under-offer show the marketing display price.
  const status = mapStatus(raw);
  const saleP = Number(raw.sale_price);
  const priceDisplay =
    status === "sold"
      ? raw.price_undisclosed
        ? "Price undisclosed"
        : saleP
        ? "$" + saleP.toLocaleString("en-AU")
        : "Sold"
      : raw.price_undisclosed
      ? "Contact Agent"
      : raw.display_price || "Contact Agent";

  return {
    id: String(raw.id),
    slug: slugify(`${street} ${suburb}`) || String(raw.id),
    status,
    category: mapCategory(raw),
    headline: raw.advertising_copy?.heading ?? `${street}, ${suburb}`,
    address: {
      street,
      suburb,
      state: p.state ?? "VIC",
      postcode: p.postcode ?? "",
    },
    priceDisplay,
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
    auctionAt:
      raw.auction && raw.auction_date
        ? `${raw.auction_date}T${raw.auction_time ?? "12:00"}`
        : undefined,
    geo: p.latitude && p.longitude ? { lat: Number(p.latitude), lng: Number(p.longitude) } : undefined,
    documents, // website-tagged files (read-only), SOI excluded — it has its own button
    soiUrl,
    videoUrl: raw.video_link_url || undefined,
    updatedAt: raw.sale_date ?? raw.date_listed ?? new Date().toISOString(),
  };
}

/**
 * The two CRM reads the whole site is built on, cached server-side.
 *
 * `unstable_cache` rather than fetch options, because pages that declare
 * `dynamic = "force-dynamic"` silently switch every fetch inside them to
 * no-store. That turned each page view into a full re-fetch of every listing
 * and consultant, and with rate limiting a single /properties request took 43
 * seconds (3 Sep 2026). This cache sits above fetch, so it holds regardless of
 * how the route renders, and one populated entry serves every visitor.
 *
 * Tagged so /api/revalidate can clear it the moment a listing changes.
 */
const cachedSalesListings = unstable_cache(
  () => paginate("/sales_listings", "sales_listings"),
  ["boxdice", "sales_listings"],
  { revalidate: REVALIDATE, tags: ["listings"] }
);

const cachedConsultants = unstable_cache(
  () => paginate("/consultants", "consultants"),
  ["boxdice", "consultants"],
  { revalidate: REVALIDATE, tags: ["listings"] }
);

async function getConsultants(): Promise<Map<number, Agent>> {
  const map = new Map<number, Agent>();
  try {
    const list = await cachedConsultants();
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

/**
 * Raw, unfiltered sales listings straight from Box & Dice.
 *
 * DIAGNOSTIC USE ONLY. getListings() below is what the site renders — it
 * normalises and filters by website_status. This returns the untouched records
 * so we can inspect fields the UI never reads (tags, sensitivity flags) while
 * designing the off-market portal. Never render this to a visitor.
 */
export async function getRawSalesListings(): Promise<any[]> {
  if (USE_MOCK) return [];
  // noStore: a diagnostic that reads a ten-minute-old cache is worse than
  // useless — it reports the state before whatever you just changed.
  return paginate("/sales_listings", "sales_listings", true);
}

/**
 * Off-market listings for the portal.
 *
 * The rule, settled against the live CRM:
 *   - carries the Box & Dice PROPERTY tag "Off Market" (Listing Tags never reach
 *     the API), matched case- and punctuation-insensitively
 *   - status is "current" — property tags outlive the campaign, so this is
 *     what drops a sold property off the portal without anyone tidying the tag
 *   - not marked sensitive or hidden
 *
 * Only the tag can ADD a listing. Status only ever REMOVES one. A listing that
 * is current but untagged is not-yet-advertised, not off-market — see the
 * eleven such campaigns found on 1 Sep 2026.
 *
 * Prices are stripped: the portal doesn't show them, by decision.
 */
const OFF_MARKET_TAG = "offmarket";
const normTag = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function isOffMarket(raw: any): boolean {
  const tagged = (raw.property?.tags ?? []).some((t: unknown) => normTag(t) === OFF_MARKET_TAG);
  return (
    tagged &&
    String(raw.status ?? "").toLowerCase() === "current" &&
    raw.situation_very_sensitive !== true &&
    raw.hidden !== true
  );
}

/**
 * Uses the CACHED fetch, deliberately. An uncached read here meant every
 * portal visit hit Box & Dice directly, and a 429 took the whole page down
 * with it. Sharing the cache with getListings() means one fetch serves the
 * public site and the portal alike, at most `REVALIDATE` seconds old — the
 * off-market list changes when a tag changes, not by the second.
 */
export async function getOffMarketListings(): Promise<Listing[]> {
  if (USE_MOCK) return [];
  const consultants = await getConsultants();
  const raw = await cachedSalesListings();
  const byId = new Map<string, any>();
  for (const r of raw) byId.set(String(r.id), r);
  return [...byId.values()]
    .filter(isOffMarket)
    .map((r) => ({ ...normalise(r, consultants), priceDisplay: "" }))
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export async function getListings(): Promise<Listing[]> {
  if (USE_MOCK) return MOCK_LISTINGS;
  try {
    const consultants = await getConsultants();
    const raw = await cachedSalesListings();
    const listings = raw
      // show only what the agent has published via "My Website Status"
      .filter(isWebsiteVisible)
      .map((r) => normalise(r, consultants));
    // de-dupe (pagination can return an updated record again) + newest first
    const byId = new Map(listings.map((l) => [l.id, l]));
    return [...byId.values()].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  } catch (err) {
    // Deliberately NOT falling back to mock data. Publishing invented
    // addresses and prices on a licensed agent's website is far worse than
    // showing nothing, and it hid three real outages by looking like content.
    //
    // Throwing is also the right ISR behaviour: when a background revalidation
    // fails, Next keeps serving the last good page, so a rate-limit blip is
    // invisible to visitors. Only a cold cache reaches the error boundary.
    console.error("[boxdice] listings unavailable:", err);
    throw err;
  }
}

export async function getListingBySlug(slug: string): Promise<Listing | null> {
  const listings = await getListings();
  return listings.find((l) => l.slug === slug) ?? null;
}

/* ── Vendor marketing approval ────────────────────────────────────────────
   The approval tool needs listings the public site never shows — campaigns
   that are being prepared — and fields the public site never reads: the
   image index labels, the floorplans as their own set, the raw advertising
   copy. This is that view. Still read-only. */

export type MarketingSource = {
  id: number;
  status: string; // CRM status: current, not_settled, settled, listing_cancelled…
  address: string; // "76B Paxton Street, South Kingsville"
  streetName: string; // "Paxton" — for the SharePoint folder match
  number: string; // "76B"
  suburb: string;
  photos: { url: string; index: string }[]; // MAIN first, then A–Z
  floorplans: { url: string; index: string }[];
  copyHeading: string;
  copyText: string;
  videoUrl: string | null;
  agents: Agent[];
  dateListed: string | null;
};

function toMarketingSource(raw: any, consultants: Map<number, Agent>): MarketingSource {
  const p = raw.property ?? {};
  const idx = (i: any) => String(i?.index ?? "").toUpperCase();
  const imgs = (raw.images ?? []).filter((i: any) => i?.url);
  const main = imgs.filter((i: any) => idx(i) === "MAIN");
  const gallery = imgs
    .filter((i: any) => idx(i) !== "MAIN" && !idx(i).startsWith("FLOORPLAN"))
    .sort((a: any, b: any) => idx(a).localeCompare(idx(b), undefined, { numeric: true }));
  const floorplans = imgs
    .filter((i: any) => idx(i).startsWith("FLOORPLAN"))
    .sort((a: any, b: any) => idx(a).localeCompare(idx(b), undefined, { numeric: true }));
  const agentIds: number[] = raw.consultant_ids ?? (raw.primary_consultant_id ? [raw.primary_consultant_id] : []);
  const number = [p.unit ? `${p.unit}/` : "", p.number].join("").replace(" /", "/");

  return {
    id: Number(raw.id),
    status: String(raw.status ?? ""),
    address: `${buildStreet(p)}, ${titleCase(p.suburb ?? "")}`,
    streetName: String(p.street_name ?? ""),
    number,
    suburb: titleCase(p.suburb ?? ""),
    photos: [...main, ...gallery].map((i: any) => ({ url: i.url, index: idx(i) })),
    floorplans: floorplans.map((i: any) => ({ url: i.url, index: idx(i) })),
    copyHeading: String(raw.advertising_copy?.heading ?? "").trim(),
    copyText: String(raw.advertising_copy?.text ?? "").trim(),
    videoUrl: raw.video_link_url ? String(raw.video_link_url) : null,
    agents: agentIds.map((id) => consultants.get(id)).filter(Boolean) as Agent[],
    dateListed: raw.date_listed ?? raw.campaign_start_date ?? null,
  };
}

/**
 * Listings that could be sent for approval: status "current" in the CRM,
 * newest first. `includeAll` widens it to any listing with photos — for
 * re-opening a past campaign, or testing against a finished one.
 */
export async function getMarketingSources(includeAll = false): Promise<MarketingSource[]> {
  if (USE_MOCK) return [];
  const consultants = await getConsultants();
  const raw = await cachedSalesListings();
  const byId = new Map<string, any>();
  for (const r of raw) byId.set(String(r.id), r);
  return [...byId.values()]
    .filter((r) =>
      includeAll
        ? (r.images ?? []).length > 0
        : String(r.status ?? "").toLowerCase() === "current"
    )
    .map((r) => toMarketingSource(r, consultants))
    .sort((a, b) => +new Date(b.dateListed ?? 0) - +new Date(a.dateListed ?? 0));
}

/** One listing by id, any status — a campaign may be sold by the time it's re-opened. */
export async function getMarketingSource(id: number | string): Promise<MarketingSource | null> {
  if (USE_MOCK) return null;
  const consultants = await getConsultants();
  const raw = await cachedSalesListings();
  const hit = [...raw].reverse().find((r) => String(r.id) === String(id)); // latest record wins
  return hit ? toMarketingSource(hit, consultants) : null;
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
