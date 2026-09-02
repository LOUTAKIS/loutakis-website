#!/usr/bin/env node
//
//   node scripts/bd-assign-category.mjs 5050 --confirm
//
// WRITES. Works out how to assign a contact category, because the docs name the
// operation but not the path or payload shape.
//
// Tries the plausible combinations against ONE contact you name — use the ZZ
// TEST contact, not a real one — and stops at the first that works, printing
// the exact path and body so we can hard-code it in the portal.

import { loadEnv, headers } from "./_bd.mjs";

const id = process.argv[2];
if (!id || !process.argv.includes("--confirm")) {
  console.error(
    "\n  Usage: node scripts/bd-assign-category.mjs <contact id> --confirm\n" +
      "  Use the ZZ TEST contact (5050), not a real one.\n"
  );
  process.exit(1);
}

const { key, base } = loadEnv();
const CATEGORY = "Off Market List - Pending";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const attempts = [
  { path: `/contacts/${id}/categories`, body: { categories: [CATEGORY] } },
  { path: `/contacts/${id}/categories`, body: { categories: [{ name: CATEGORY }] } },
  { path: `/contacts/${id}/contact_categories`, body: { categories: [CATEGORY] } },
  { path: `/contacts/${id}/contact_categories`, body: { contact_categories: [{ name: CATEGORY }] } },
  { path: `/contact_categories`, body: { contact_id: Number(id), categories: [CATEGORY] } },
  { path: `/contact_categories`, body: { contact_id: Number(id), contact_categories: [{ name: CATEGORY }] } },
];

for (const a of attempts) {
  await sleep(1500); // the API 429s on back-to-back calls
  const label = `${a.path}  ${JSON.stringify(a.body)}`;

  let res;
  try {
    res = await fetch(`${base}${a.path}`, {
      method: "POST",
      headers: headers(key, true),
      body: JSON.stringify(a.body),
    });
  } catch (err) {
    console.log(`✗ ${label}\n    network error: ${err}\n`);
    continue;
  }

  const text = await res.text();
  const short = text.slice(0, 220).replace(/\s+/g, " ");

  if (res.ok) {
    console.log(`\n✓ WORKS — ${res.status}\n\n  path: ${a.path}\n  body: ${JSON.stringify(a.body)}\n  response: ${short}\n`);
    console.log("Verify with:  node scripts/bd-contact-read.mjs " + id);
    process.exit(0);
  }

  console.log(`✗ ${res.status}  ${label}\n    ${short}\n`);
}

console.log("\nNone worked. Paste this output and I'll narrow it down.\n");
