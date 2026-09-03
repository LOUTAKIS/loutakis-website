#!/usr/bin/env node
//
//   node scripts/bd-criteria-check.mjs 5054
//
// Reads a contact back from Box & Dice and shows just what matters for the
// portal: their categories, and whether real buying criteria were written —
// with suburb ids resolved back to names, so it's checkable at a glance.

import { readFileSync, existsSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const contactId = process.argv[2];
if (!contactId) {
  console.error("\n  usage: node scripts/bd-criteria-check.mjs <contactId>\n");
  process.exit(1);
}

const env = {};
for (const line of readFileSync(new URL(".env.local", ROOT), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const BASE = (env.BOXDICE_API_BASE || "https://loutakis.boxdice.com.au/website_api").replace(/\/$/, "");

// suburb id -> name, so the output is readable
const names = new Map();
const mapFile = new URL("lib/suburbs-vic.json", ROOT);
if (existsSync(mapFile)) {
  for (const [key, id] of Object.entries(JSON.parse(readFileSync(mapFile, "utf8")))) {
    names.set(id, key.split("|")[0]);
  }
}

const res = await fetch(`${BASE}/contacts/${contactId}`, {
  headers: { Authorization: `Api-Key token=${env.BOXDICE_API_KEY}`, Accept: "application/json" },
});
if (!res.ok) {
  console.error(`${res.status} ${res.statusText}`);
  process.exit(1);
}

const json = await res.json();
const c = json.contact ?? json;

console.log(`\n${c.first_name} ${c.last_name}  ·  contact ${c.id}`);
console.log(`   ${c.email}  ·  ${c.mobile}`);
console.log(`   marketing: email ${c.permit_email_campaign}, sms ${c.permit_sms}`);

console.log("\nCategories:");
for (const cat of c.categories ?? []) console.log(`   • ${cat.name}`);
if (!(c.categories ?? []).length) console.log("   (none)");

console.log("\nBuying criteria:");
for (const cr of c.criteria ?? []) {
  const suburbs = (cr.suburb_ids ?? []).map((id) => names.get(id) ?? `#${id}`);
  console.log(`   • criteria ${cr.id} (${cr.type})`);
  if (suburbs.length) console.log(`     suburbs:  ${suburbs.join(", ")}`);
  if (cr.beds_from) console.log(`     beds_from: ${cr.beds_from}`);
  if (cr.price_from || cr.price_to)
    console.log(`     price:     ${cr.price_from ?? "—"} to ${cr.price_to ?? "—"}`);
  if (cr.notes) console.log(`     notes:     ${cr.notes}`);
}
if (!(c.criteria ?? []).length) {
  console.log("   (none — nothing searchable was written)");
}
console.log("");
