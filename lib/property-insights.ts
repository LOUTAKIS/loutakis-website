import "server-only";
import { getListings } from "./boxdice";
import type { NamedCount } from "./web-analytics";

/**
 * What each property is actually doing: how many people looked, and how many
 * asked about it.
 *
 * The Website page used to show "/properties/19-william-street-newport — 122"
 * in a list of paths, which is a URL where an address should be. This turns
 * the slug back into the property, puts the enquiry count beside it, and
 * includes the listings NOBODY looked at — a property with no views is the
 * most useful row on the page, and it is the one a top-pages list can never
 * show you.
 *
 * VIEWS AND ENQUIRIES ARE NOT THE SAME KIND OF NUMBER and are deliberately
 * shown together. Plenty of views with no enquiries is a price conversation;
 * no views at all is a marketing one. Either alone would point at the wrong
 * problem.
 */

export type PropertyInsight = {
  id: string;
  address: string;
  suburb: string;
  status: string;
  slug: string;
  visitors: number;
  pageviews: number;
  enquiries: number;
};

/** "/properties/19-william-street-newport" → "19-william-street-newport". */
function slugOf(path: string): string {
  const m = String(path).match(/\/properties\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]).toLowerCase() : "";
}

export async function propertyInsights(
  propertyPaths: NamedCount[],
  enquiriesByListing: Record<string, number>
): Promise<PropertyInsight[]> {
  let listings: Awaited<ReturnType<typeof getListings>> = [];
  try {
    listings = await getListings();
  } catch (err) {
    console.error("[property insights] listings unavailable", err);
    return [];
  }

  const views = new Map<string, { visitors: number; pageviews: number }>();
  for (const p of propertyPaths) {
    const slug = slugOf(p.name);
    if (!slug) continue;
    const at = views.get(slug) ?? { visitors: 0, pageviews: 0 };
    /**
     * Summed rather than replaced. The same property can appear under more
     * than one path — a trailing slash, a stray query string that Vercel kept
     * — and taking the first would quietly undercount a campaign.
     */
    at.visitors += p.visitors;
    at.pageviews += p.pageviews;
    views.set(slug, at);
  }

  const rows = listings.map((l) => {
    const v = views.get(String(l.slug).toLowerCase()) ?? { visitors: 0, pageviews: 0 };
    return {
      id: String(l.id),
      address: `${l.address.street}, ${l.address.suburb}`,
      suburb: l.address.suburb,
      status: l.status,
      slug: l.slug,
      visitors: v.visitors,
      pageviews: v.pageviews,
      enquiries: enquiriesByListing[String(l.id)] ?? 0,
    };
  });

  /**
   * Current listings first and busiest at the top; a sold one with traffic is
   * still interesting, but it is not what anyone opened this page to see.
   */
  const rank = (r: PropertyInsight) => (r.status === "current" || r.status === "under_offer" ? 0 : 1);
  return rows.sort(
    (a, b) => rank(a) - rank(b) || b.visitors - a.visitors || a.address.localeCompare(b.address, "en-AU")
  );
}
