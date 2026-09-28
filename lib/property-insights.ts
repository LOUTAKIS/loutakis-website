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
 *
 * CURRENT AND SOLD ARE SEPARATED. Showing everything made a table forty rows
 * long, of which two were live — and a list that long is one nobody reads to
 * the bottom of. What is selling now is the page; what sold is an archive, and
 * an archive belongs behind something you have to open.
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

export type PropertySplit = {
  /** On the market now, busiest first. This is the table. */
  current: PropertyInsight[];
  /** Sold or leased, and only those anyone actually looked at in the window. */
  past: PropertyInsight[];
};

export async function propertyInsights(
  propertyPaths: NamedCount[],
  enquiriesByListing: Record<string, number>
): Promise<PropertySplit> {
  let listings: Awaited<ReturnType<typeof getListings>> = [];
  try {
    listings = await getListings();
  } catch (err) {
    console.error("[property insights] listings unavailable", err);
    return { current: [], past: [] };
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

  const busiest = (a: PropertyInsight, b: PropertyInsight) =>
    b.visitors - a.visitors ||
    b.enquiries - a.enquiries ||
    a.address.localeCompare(b.address, "en-AU");

  const live = (r: PropertyInsight) => r.status === "current" || r.status === "under_offer";

  return {
    // Every live listing, including the ones with no views — a property nobody
    // has opened is the most useful row on the page, and it only exists if the
    // zeros are kept.
    current: rows.filter(live).sort(busiest),
    /**
     * Sold ones only if somebody actually looked in this window. Keeping the
     * zeros here would be forty rows of nothing: a sold property with no views
     * says only that it sold, which you already knew.
     */
    past: rows.filter((r) => !live(r) && (r.visitors > 0 || r.enquiries > 0)).sort(busiest),
  };
}
