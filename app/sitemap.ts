import type { MetadataRoute } from "next";
import { getListings } from "@/lib/boxdice";

/**
 * The sitemap, built from the CRM.
 *
 * Listings appear and disappear on Box & Dice's schedule, not on ours, so a
 * hand-written sitemap would be wrong within a week. This asks the CRM what
 * exists right now and reports `updatedAt` as lastModified, which is the field
 * Google actually uses to decide whether a re-crawl is worth its time.
 *
 * Regenerated hourly rather than per request: a crawler hitting it repeatedly
 * must not turn into repeated Box & Dice calls, which is how we hit the rate
 * limit in the first place.
 */
export const revalidate = 3600;

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.loutakis.com.au").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    // The page that wins listings, so it outranks everything except the home page.
    { url: `${BASE}/sell-with-us`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/properties`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.1 },
  ];

  /**
   * A CRM outage must not produce an empty sitemap. Submitting one that has
   * dropped every listing tells Google those pages are gone, and it acts on
   * that — so on failure we return the static pages alone and leave the
   * listings to the previously submitted version.
   */
  let listingPages: MetadataRoute.Sitemap = [];
  try {
    const listings = await getListings();
    listingPages = listings.map((l) => {
      const when = new Date(l.updatedAt);
      return {
        url: `${BASE}/properties/${l.slug}`,
        lastModified: isNaN(+when) ? now : when,
        // A live campaign changes constantly — inspections, price, status. A
        // sold record is finished and only worth re-crawling occasionally.
        changeFrequency: l.status === "sold" || l.status === "leased" ? "monthly" : "daily",
        priority: l.status === "sold" || l.status === "leased" ? 0.4 : 0.7,
      } satisfies MetadataRoute.Sitemap[number];
    });
  } catch (err) {
    console.error("[sitemap] listings unavailable, serving static pages only:", err);
  }

  return [...staticPages, ...listingPages];
}
