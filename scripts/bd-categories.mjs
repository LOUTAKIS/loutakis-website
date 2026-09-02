#!/usr/bin/env node
//
//   node scripts/bd-categories.mjs
//
// Read-only. Lists the contact categories that exist in Box & Dice.
//
// The portal marks approval state with a contact category, and the API can only
// ASSIGN categories that already exist — it can't create them. So we need to
// know what's there before designing the approval step.
//
// The docs name the resource but not the exact path, so this tries the likely
// ones and reports which answered.

import { loadEnv, headers } from "./_bd.mjs";

const { key, base } = loadEnv();

const candidates = [
  "/contact_category_types",
  "/contact_category_types?expand=true",
  "/contact_categories",
  "/contact_categories?expand=true",
  "/categories",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const path of candidates) {
  await sleep(1500); // the API 429s almost immediately on back-to-back calls
  let res;
  try {
    res = await fetch(`${base}${path}`, { headers: headers(key) });
  } catch (err) {
    console.log(`${path.padEnd(38)} network error: ${err}`);
    continue;
  }

  if (res.status === 404) {
    console.log(`${path.padEnd(38)} 404`);
    continue;
  }
  if (res.status === 204) {
    console.log(`${path.padEnd(38)} 204 (exists, empty)`);
    continue;
  }
  if (!res.ok) {
    console.log(`${path.padEnd(38)} ${res.status} ${res.statusText}`);
    continue;
  }

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 300);
  }

  console.log(`\n=== ${path} → ${res.status} ===`);
  console.log(JSON.stringify(body, null, 2).slice(0, 4000));
}
