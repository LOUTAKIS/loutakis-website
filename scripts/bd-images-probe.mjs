#!/usr/bin/env node
//
//   node scripts/bd-images-probe.mjs herbert
//
// Dumps the raw image records for one listing (matched on street name), so we
// can see whether the floorplan tag set in the CRM's photo section reaches the
// Website API — the docs list only `index` and `url` per image.

import { readFileSync } from "node:fs";

const needle = (process.argv[2] ?? "herbert").toLowerCase();

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const BASE = (env.BOXDICE_API_BASE || "https://loutakis.boxdice.com.au/website_api").replace(/\/$/, "");
const H = { Authorization: `Api-Key token=${env.BOXDICE_API_KEY}`, Accept: "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let url = `${BASE}/sales_listings`;
let found = null;
for (let i = 0; i < 20 && url && !found; i++) {
  const res = await fetch(url, { headers: H });
  if (res.status === 429) { await sleep(Number(res.headers.get("retry-after") || 10) * 1000); continue; }
  if (res.status === 204) break;
  const json = await res.json();
  for (const l of json.data ?? []) {
    const street = String(l.property?.street_name ?? "").toLowerCase();
    if (street.includes(needle) && (l.images ?? []).length) found = l;
  }
  url = json?.paging?.next ?? null;
  if (url && !found) await sleep(2000);
}

if (!found) { console.log("no listing with images matched", needle); process.exit(0); }

const p = found.property;
console.log(`\n${p.number} ${p.street_name} ${p.street_type} ${p.suburb} · listing ${found.id}\n`);
console.log("Every key present on image records:");
const keys = new Set();
for (const img of found.images) Object.keys(img).forEach((k) => keys.add(k));
console.log("  ", [...keys].join(", "));

console.log("\nImages (url shortened):");
for (const img of found.images) {
  const { url, ...rest } = img;
  const tail = String(url ?? "").split("/").slice(-1)[0].slice(0, 48);
  console.log("  ", JSON.stringify(rest), "…" + tail);
}

console.log("\nOther listing fields that might carry a floorplan:");
for (const k of ["interactive_floor_plan_url", "virtual_tour_url", "video_link_url", "public_files"]) {
  console.log(`   ${k}:`, JSON.stringify(found[k]));
}
console.log("\nadvertising_copy heading:", found.advertising_copy?.heading);
console.log("advertising_copy text (first 200):", String(found.advertising_copy?.text ?? "").slice(0, 200), "\n");
