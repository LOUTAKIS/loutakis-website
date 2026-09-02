#!/usr/bin/env node
//
//   node scripts/bd-paging-check.mjs
//
// Read-only. Are we fetching ALL listings, or only the first page?
//
// The API blueprint documents the envelope as { data: [...], paging: { next } },
// but lib/boxdice.ts reads `json.next` — which is undefined, so the loop stops
// after page one. If Box & Dice returns a paging.next here, the live website has
// been showing a subset of the listings.

import { loadEnv, headers } from "./_bd.mjs";

const { key, base } = loadEnv();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const res = await fetch(`${base}/sales_listings`, { headers: headers(key) });
const json = await res.json();

const rows = Array.isArray(json) ? json : json.data ?? [];
const pagingNext = json?.paging?.next ?? null;
const topLevelNext = typeof json?.next === "string" ? json.next : null;

console.log(
  JSON.stringify(
    {
      status: res.status,
      firstPageCount: rows.length,
      topLevelKeys: Object.keys(json ?? {}),
      "json.next (what our code reads)": topLevelNext,
      "json.paging.next (what the docs say)": pagingNext,
    },
    null,
    2
  )
);

if (!pagingNext && !topLevelNext) {
  console.error("\n  One page only — 76 listings is the whole book. No bug in practice.\n");
  process.exit(0);
}

// Follow the documented cursor properly and count the real total.
let url = pagingNext ?? topLevelNext;
let total = rows.length;
let pages = 1;

while (url && pages < 50) {
  await sleep(10000); // documented: 10s after a 200
  process.stderr.write(`  page ${pages + 1}…\n`);
  const r = await fetch(url, { headers: headers(key) });
  if (r.status === 204) break;
  if (!r.ok) {
    console.error(`  stopped: ${r.status}`);
    break;
  }
  const j = await r.json();
  const batch = Array.isArray(j) ? j : j.data ?? [];
  if (!batch.length) break;
  total += batch.length;
  pages += 1;
  url = j?.paging?.next ?? (typeof j?.next === "string" ? j.next : null);
}

console.error(
  `\n  Followed ${pages} pages: ${total} listings total, vs ${rows.length} the site currently sees.\n` +
    (total > rows.length ? "  → THE SITE IS MISSING LISTINGS.\n" : "  → No listings missing.\n")
);
