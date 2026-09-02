#!/usr/bin/env node
//
//   node scripts/bd-contact-dedup.mjs
//
// THIS WRITES TO YOUR LIVE CRM. It creates a contact called
// "ZZ TEST — Portal Dedup" three times with small variations, to answer the
// question the whole portal design rests on: does Box & Dice reuse an exact
// match, or does it create duplicates?
//
// It writes contacts only — it cannot touch listings. The payload is fixed.
// Afterwards, search Contacts for "ZZ TEST" in Box & Dice and delete it.
//
// Requires --confirm so it can't run by accident:
//
//   node scripts/bd-contact-dedup.mjs --confirm

import { loadEnv, headers } from "./_bd.mjs";

if (!process.argv.includes("--confirm")) {
  console.error(
    "\n  This writes test contacts to the live CRM.\n" +
      "  Re-run with --confirm if that's what you want:\n\n" +
      "    node scripts/bd-contact-dedup.mjs --confirm\n"
  );
  process.exit(1);
}

const { key, base } = loadEnv();

// example.com is reserved — no real mailbox can ever receive anything.
const EMAIL = "zz.portal.dedup@example.com";

const variations = [
  ["1. baseline", { first_name: "ZZ TEST", last_name: "Portal Dedup", email: EMAIL, mobile: "0400000000" }],
  ["2. same, email UPPERCASE", { first_name: "ZZ TEST", last_name: "Portal Dedup", email: EMAIL.toUpperCase(), mobile: "0400000000" }],
  ["3. same email, different mobile", { first_name: "ZZ TEST", last_name: "Portal Dedup", email: EMAIL, mobile: "0411111111" }],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

for (const [label, contact] of variations) {
  process.stderr.write(`  ${label}…\n`);
  const res = await fetch(`${base}/contacts`, {
    method: "POST",
    headers: headers(key, true),
    body: JSON.stringify({ contact }),
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 400);
  }

  results.push({ label, status: res.status, body });
  await sleep(1200); // the API rate-limits per endpoint
}

const ids = results.map((r) => r.body?.id ?? r.body?.contact?.id ?? r.body?.data?.id ?? null);
const distinct = [...new Set(ids.filter((i) => i !== null).map(String))];

const verdict =
  distinct.length === 0
    ? "COULD NOT READ IDS — check the raw responses below."
    : distinct.length === 1
    ? "DEDUPLICATED — all three writes returned the same contact id. Registrations can write straight to the CRM."
    : `NOT DEDUPLICATED — ${distinct.length} separate contacts created. Registrations must be held in the portal and pushed only on approval.`;

console.log(JSON.stringify({ verdict, ids, distinctIds: distinct, results }, null, 2));
console.error(`\n  ${verdict}\n  Clean up: search Contacts for "ZZ TEST" in Box & Dice.\n`);
