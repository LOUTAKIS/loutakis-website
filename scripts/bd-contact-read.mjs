#!/usr/bin/env node
//
//   node scripts/bd-contact-read.mjs 5050
//
// Read one contact back from Box & Dice. Read-only.
//
// Written to answer a specific question: when a repeat "create" matches an
// existing contact, does Box & Dice OVERWRITE the stored details with whatever
// was submitted? If a portal registration can overwrite a real client's mobile
// number, registrations must not write directly to the CRM.

import { loadEnv, headers } from "./_bd.mjs";

const id = process.argv[2];
if (!id) {
  console.error("\n  Usage: node scripts/bd-contact-read.mjs <contact id>\n");
  process.exit(1);
}

const { key, base } = loadEnv();

const res = await fetch(`${base}/contacts/${encodeURIComponent(id)}`, {
  headers: headers(key),
});

const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text.slice(0, 800);
}

if (!res.ok) {
  console.error(`\n  ${res.status} ${res.statusText}\n`);
}

console.log(JSON.stringify(body, null, 2));

// The test wrote 0400000000 first, then 0411111111 on the third attempt.
const mobile = body?.mobile ?? body?.contact?.mobile;
if (mobile) {
  console.error(
    `\n  Stored mobile: ${mobile}\n` +
      (mobile.replace(/\D/g, "") === "0411111111"
        ? "  → OVERWRITTEN. A repeat registration replaces existing contact details.\n"
        : mobile.replace(/\D/g, "") === "0400000000"
        ? "  → PRESERVED. The first value stood; repeat writes don't clobber.\n"
        : "  → Neither test value. Worth a look.\n")
  );
}
