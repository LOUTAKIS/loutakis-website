#!/usr/bin/env node
//
//   node scripts/bd-assets-probe.mjs
//
// What marketing material does Box & Dice already hold per listing? Whatever
// is here can populate a vendor approval page automatically; whatever isn't
// stays a manual upload. Reports on every listing, so we can see how
// consistently each field is actually used in practice.

import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const BASE = (env.BOXDICE_API_BASE || "https://loutakis.boxdice.com.au/website_api").replace(/\/$/, "");
const H = { Authorization: `Api-Key token=${env.BOXDICE_API_KEY}`, Accept: "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let url = `${BASE}/sales_listings`;
const all = [];
for (let i = 0; i < 20 && url; i++) {
  const res = await fetch(url, { headers: H });
  if (res.status === 429) {
    const wait = Number(res.headers.get("retry-after") || 10) * 1000;
    console.log(`  rate limited, waiting ${wait / 1000}s…`);
    await sleep(wait);
    continue;
  }
  if (res.status === 204) break;
  if (!res.ok) { console.error(res.status, res.statusText); process.exit(1); }
  const json = await res.json();
  const batch = json.data ?? [];
  if (!batch.length) break;
  all.push(...batch);
  url = json?.paging?.next ?? null;
  if (url) await sleep(2000);
}

const byId = new Map(all.map((l) => [l.id, l]));
const listings = [...byId.values()];
console.log(`\n${listings.length} listings\n${"=".repeat(70)}`);

const tally = { images: 0, copy: 0, video: 0, floorplan: 0, tour: 0, soi: 0, files: 0 };

for (const l of listings) {
  const p = l.property ?? {};
  const addr = [p.number, p.street_name, p.street_type, p.suburb].filter(Boolean).join(" ");
  const files = l.public_files ?? [];
  const has = {
    images: (l.images ?? []).length,
    copy: Boolean(l.advertising_copy?.text),
    video: Boolean(l.video_link_url),
    floorplan: Boolean(l.interactive_floor_plan_url),
    tour: Boolean(l.virtual_tour_url),
    soi: Boolean(l.soi_file),
    files: files.length,
  };
  for (const k of Object.keys(tally)) if (has[k]) tally[k]++;

  console.log(
    `\n${addr}  [${l.status}/${l.website_status ?? "-"}]` +
      `\n   images ${has.images} · copy ${has.copy ? "yes" : "NO"} · video ${has.video ? "yes" : "NO"}` +
      ` · floorplan ${has.floorplan ? "yes" : "NO"} · tour ${has.tour ? "yes" : "NO"} · soi ${has.soi ? "yes" : "NO"}` +
      ` · public_files ${has.files}`
  );
  for (const f of files) console.log(`      file: "${f.name}" — ${f.description ?? "no description"}`);
}

console.log(`\n${"=".repeat(70)}\nHow many listings have each (out of ${listings.length}):`);
for (const [k, v] of Object.entries(tally)) console.log(`   ${k.padEnd(12)} ${v}`);
console.log("");
