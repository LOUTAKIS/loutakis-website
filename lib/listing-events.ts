import type { Listing } from "./types";
import type { CalendarEvent } from "./ics";

/**
 * A listing's inspections and auction, as calendar events.
 *
 * Shared by the .ics route and the buttons on the page, so the file a buyer
 * downloads and the Google link beside it can never describe different events.
 */

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.loutakis.com.au").replace(/\/$/, "");

/** An hour's warning: long enough to leave, short enough to still be the plan. */
const REMIND_MINUTES = 60;

function fullAddress(l: Listing): string {
  return [l.address.street, l.address.suburb, l.address.state, l.address.postcode]
    .filter(Boolean)
    .join(" ");
}

function contactLine(l: Listing): string {
  const a = l.agents[0];
  if (!a) return "";
  return [a.name, a.phone].filter(Boolean).join(" · ");
}

/**
 * Never offer a calendar event for a property that has sold — the same rule the
 * page itself follows. Someone turning up to an open at a house that is gone is
 * the worst possible use of this feature.
 */
function sellable(l: Listing): boolean {
  return l.status !== "sold" && l.status !== "leased";
}

export function inspectionEvent(l: Listing, index: number): CalendarEvent | null {
  if (!sellable(l)) return null;
  const insp = l.inspections?.[index];
  if (!insp?.start) return null;

  const where = fullAddress(l);
  const contact = contactLine(l);

  return {
    // Stable: adding it twice updates the same entry instead of duplicating it.
    uid: `inspection-${l.id}-${index}@loutakis.com.au`,
    start: insp.start,
    end: insp.end || undefined,
    title: `Inspection — ${l.address.street}, ${l.address.suburb}`,
    location: where,
    description: [
      `Open for inspection at ${where}.`,
      contact ? `Loutakis Real Estate — ${contact}` : "Loutakis Real Estate",
      `${SITE}/properties/${l.slug}`,
    ].join("\n"),
    url: `${SITE}/properties/${l.slug}`,
    remindMinutes: REMIND_MINUTES,
  };
}

export function auctionEvent(l: Listing): CalendarEvent | null {
  if (!sellable(l) || !l.auctionAt) return null;

  const where = fullAddress(l);
  const contact = contactLine(l);

  return {
    uid: `auction-${l.id}@loutakis.com.au`,
    start: l.auctionAt,
    // Auctions are called on time and are rarely long; half an hour is honest.
    end: new Date(+new Date(l.auctionAt) + 30 * 60000).toISOString(),
    title: `Auction — ${l.address.street}, ${l.address.suburb}`,
    location: where,
    description: [
      `Auction at ${where}.`,
      contact ? `Loutakis Real Estate — ${contact}` : "Loutakis Real Estate",
      `${SITE}/properties/${l.slug}`,
    ].join("\n"),
    url: `${SITE}/properties/${l.slug}`,
    // Two hours for an auction: people need to arrange to be there, not just
    // to leave the house.
    remindMinutes: 120,
  };
}
