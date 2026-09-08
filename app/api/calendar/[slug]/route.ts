import { getListingBySlug } from "@/lib/boxdice";
import { buildIcs } from "@/lib/ics";
import { inspectionEvent, auctionEvent } from "@/lib/listing-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The calendar file for one inspection, or the auction.
 *
 *   /api/calendar/19-william-street-newport?i=0     the first inspection
 *   /api/calendar/19-william-street-newport?auction=1
 *
 * Built from the CRM at request time rather than from anything in the URL, so a
 * cancelled inspection cannot be added to a calendar from a stale link, and
 * nobody can mint an event for a house we are not selling.
 */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const listing = await getListingBySlug(params.slug);
  if (!listing) return new Response("Not found", { status: 404 });

  const { searchParams } = new URL(req.url);
  const wantsAuction = searchParams.get("auction") === "1";

  const event = wantsAuction
    ? auctionEvent(listing)
    : inspectionEvent(listing, Number(searchParams.get("i") ?? 0));

  if (!event) return new Response("Not found", { status: 404 });

  const name = `${listing.address.street}-${wantsAuction ? "auction" : "inspection"}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return new Response(buildIcs(event), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // `attachment` is what makes iOS offer "Add to Calendar" rather than
      // rendering the file as text.
      "Content-Disposition": `attachment; filename="${name}.ics"`,
      // Times change during a campaign; never let a CDN hold one for long.
      "Cache-Control": "public, max-age=0, s-maxage=300, must-revalidate",
    },
  });
}
