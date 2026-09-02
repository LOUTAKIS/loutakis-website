#!/usr/bin/env node
//
//   node scripts/bd-inspect.mjs
//
// Read-only look at what Box & Dice actually returns: which tags are in use,
// which fields exist, and what the Off Market tag currently picks up.
// Replaces the temporary /api/portal-diagnostics route — no deploy needed.

import { loadEnv, paginate } from "./_bd.mjs";

const PORTAL_TAG = "Off Market";
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const TAG_NORM = norm(PORTAL_TAG);

const { key, base } = loadEnv();

process.stderr.write("Fetching sales listings…\n");
const raw = await paginate(base, key, "/sales_listings");

// Pagination can return an updated record more than once.
const listings = [...new Map(raw.map((l) => [String(l.id), l])).values()];

const tally = (items) => {
  const out = {};
  for (const i of items) out[i] = (out[i] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
};

const tags = tally(listings.flatMap((l) => l.property?.tags ?? []));
const statuses = tally(listings.map((l) => String(l.website_status ?? "(null)")));
const saleStatuses = tally(listings.map((l) => String(l.status ?? "(null)")));

const hasTag = (l) => (l.property?.tags ?? []).some((t) => norm(t) === TAG_NORM);
const tagged = listings.filter(hasTag);

// The portal rule. Property Tags stick to the property forever, so the tag
// alone is not enough — the campaign must also be live. The observed status
// vocabulary is: current, not_settled, settled, listing_cancelled,
// sale_cancelled. Only "current" is an active campaign; not_settled means sold
// and awaiting settlement.
const live = tagged.filter(
  (l) =>
    String(l.status ?? "").toLowerCase() === "current" &&
    l.situation_very_sensitive !== true &&
    l.hidden !== true
);

const addr = (p = {}) =>
  [p.unit ? `${p.unit}/` : "", p.number, p.street_name, p.street_type, p.suburb]
    .filter(Boolean)
    .join(" ")
    .replace(" /", "/")
    .trim();

console.log(
  JSON.stringify(
    {
      listings: listings.length,
      tagsInUse: tags,
      websiteStatuses: statuses,
      statuses: saleStatuses,
      flags: {
        situationVerySensitive: listings.filter((l) => l.situation_very_sensitive === true).length,
        hidden: listings.filter((l) => l.hidden === true).length,
        priceUndisclosed: listings.filter((l) => l.price_undisclosed === true).length,
      },
      offMarket: {
        tagged: tagged.length,
        taggedAddresses: tagged.map((l) => addr(l.property)),
        wouldShowInPortal: live.length,
        wouldShowAddresses: live.map((l) => addr(l.property)),
      },
    },
    null,
    2
  )
);
