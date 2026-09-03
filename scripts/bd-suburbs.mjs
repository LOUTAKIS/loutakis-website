#!/usr/bin/env node
//
//   node scripts/bd-suburbs.mjs
//
// Builds lib/suburbs-vic.json — a { "SUBURB|POSTCODE": id } map of every
// Victorian suburb, so the portal can send real suburb_ids to Box & Dice
// search criteria without ever calling /suburbs at runtime.
//
// /suburbs is the whole country and is rate-limited to roughly one page per
// 10 seconds, so this takes a while. It is RESUMABLE: progress is saved after
// every page, so if it stops (or you Ctrl+C it) just run it again and it picks
// up where it left off. Run it once; re-run only if Box & Dice adds suburbs.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const OUT = new URL("lib/suburbs-vic.json", ROOT);
const STATE_FILE = new URL(".suburbs-progress.json", ROOT);
const STATE = "VIC";

const env = {};
for (const line of readFileSync(new URL(".env.local", ROOT), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const KEY = env.BOXDICE_API_KEY;
const BASE = (env.BOXDICE_API_BASE || "https://loutakis.boxdice.com.au/website_api").replace(/\/$/, "");
if (!KEY || KEY.includes("[SENSITIVE]")) {
  console.error("\n  BOXDICE_API_KEY missing from .env.local\n");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let suburbs = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
let progress = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {};
let url = progress.next || `${BASE}/suburbs`;
let pages = progress.pages || 0;

const save = () => {
  writeFileSync(OUT, JSON.stringify(suburbs, null, 0) + "\n");
  writeFileSync(STATE_FILE, JSON.stringify({ next: url, pages }, null, 2));
};

console.log(`Starting from page ${pages + 1}, ${Object.keys(suburbs).length} ${STATE} suburbs so far.\n`);

while (url) {
  const res = await fetch(url, {
    headers: { Authorization: `Api-Key token=${KEY}`, Accept: "application/json" },
  });

  if (res.status === 429) {
    const wait = Number(res.headers.get("retry-after") || 10) * 1000;
    console.log(`  rate limited, waiting ${wait / 1000}s…`);
    await sleep(wait);
    continue;
  }
  if (res.status === 204) {
    console.log("\n204 — reached the end of the collection.");
    break;
  }
  if (!res.ok) {
    console.error(`\n${res.status} ${res.statusText}. Progress saved — just run the script again.`);
    save();
    process.exit(1);
  }

  const json = await res.json();
  const batch = json.suburbs ?? json.data ?? [];
  if (batch.length === 0) {
    console.log("\nEmpty batch — done.");
    break;
  }

  for (const s of batch) {
    if (String(s.state ?? "").toUpperCase() !== STATE) continue;
    const name = String(s.name ?? "").trim().toUpperCase();
    if (!name) continue;
    suburbs[`${name}|${s.postcode ?? ""}`] = Number(s.id);
  }

  pages += 1;
  const next = json?.paging?.next || json?.next || null;
  url = typeof next === "string" ? next : null;
  save();

  process.stdout.write(`\r  page ${pages} · ${Object.keys(suburbs).length} ${STATE} suburbs`);
  if (url) await sleep(10_000); // documented default for a 200
}

save();
console.log(`\n\nDone. ${Object.keys(suburbs).length} ${STATE} suburbs written to lib/suburbs-vic.json`);
console.log("Sample:", Object.entries(suburbs).slice(0, 5));
