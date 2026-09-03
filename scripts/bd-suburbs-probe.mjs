#!/usr/bin/env node
//
//   node scripts/bd-suburbs-probe.mjs
//
// One request to /suburbs. Shows the envelope key, batch size and a sample
// record, so we know the full crawl will actually collect something before
// we sit through it.

import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const BASE = (env.BOXDICE_API_BASE || "https://loutakis.boxdice.com.au/website_api").replace(/\/$/, "");

const res = await fetch(`${BASE}/suburbs`, {
  headers: { Authorization: `Api-Key token=${env.BOXDICE_API_KEY}`, Accept: "application/json" },
});

console.log("status:", res.status, res.statusText);
if (res.status !== 200) {
  console.log("retry-after:", res.headers.get("retry-after"));
  process.exit(0);
}

const json = await res.json();
const arrayKey = Object.keys(json).find((k) => Array.isArray(json[k]));
const batch = json[arrayKey] ?? [];

console.log("top-level keys:", Object.keys(json));
console.log("array is under:", arrayKey, "· batch size:", batch.length);
console.log("has paging.next:", Boolean(json?.paging?.next || json?.next));
console.log("first record:", JSON.stringify(batch[0], null, 2));
console.log(
  "states in this batch:",
  [...new Set(batch.map((s) => s.state))].join(", ")
);
