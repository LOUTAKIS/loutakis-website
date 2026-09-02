#!/usr/bin/env node
//
//   node scripts/bd-contact-search.mjs
//
// Read-only. Can we look a contact up by EMAIL?
//
// Sign-in needs it: the buyer types their email, and we have to find their
// contact to check whether they're approved. Listing all contacts is far too
// slow (thousands of records, rate-limited), and fetching by id needs the id we
// don't have yet.
//
// If none of these work, the portal needs a small store for email → contact id,
// which is a design decision, not a detail. Hence testing rather than guessing.

import { loadEnv, headers } from "./_bd.mjs";

const { key, base } = loadEnv();
const EMAIL = "zz.portal.dedup@example.com"; // the test contact, id 5050
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const candidates = [
  `/contacts?email=${encodeURIComponent(EMAIL)}`,
  `/contacts?q=${encodeURIComponent(EMAIL)}`,
  `/contacts?search=${encodeURIComponent(EMAIL)}`,
  `/contacts?filter[email]=${encodeURIComponent(EMAIL)}`,
  `/contacts?where[email]=${encodeURIComponent(EMAIL)}`,
  `/contacts/search?email=${encodeURIComponent(EMAIL)}`,
];

for (const path of candidates) {
  await sleep(1500); // 429s on back-to-back calls
  let res;
  try {
    res = await fetch(`${base}${path}`, { headers: headers(key) });
  } catch (err) {
    console.log(`✗ ${path}\n    network error: ${err}\n`);
    continue;
  }

  if (!res.ok) {
    console.log(`✗ ${res.status}  ${path}`);
    continue;
  }

  const json = await res.json().catch(() => null);
  const list = Array.isArray(json) ? json : json?.contacts ?? [];
  const emails = list.map((c) => c?.email).filter(Boolean);
  const onlyOurs = emails.length > 0 && emails.every((e) => String(e).toLowerCase() === EMAIL);

  console.log(
    `${onlyOurs ? "✓ FILTERS" : "· returns"} ${res.status}  ${path}\n` +
      `    ${list.length} contact(s)` +
      (emails.length ? `, first few: ${emails.slice(0, 3).join(", ")}` : "") +
      "\n"
  );

  if (onlyOurs) {
    console.log(`\nUse this for sign-in lookup:\n  GET ${path}\n`);
    process.exit(0);
  }
}

console.log(
  "\nNo email filter found — the portal will need a small store mapping email to contact id.\n"
);
