#!/usr/bin/env node
//
//   node scripts/bd-contact-identity.mjs --confirm
//
// WRITES TO THE LIVE CRM. Follow-up to bd-contact-dedup.mjs.
//
// That test proved Box & Dice matches on email (same email + different mobile
// returned the same contact). This tests the reverse: same mobile, DIFFERENT
// email. The answer decides whether mobile can be treated as a person's
// identity, or whether email is the only key the CRM recognises.
//
// Creates at most one extra test contact, named so it's obvious.
// Clean up: search Contacts for "ZZ TEST" in Box & Dice.

import { loadEnv, headers } from "./_bd.mjs";

if (!process.argv.includes("--confirm")) {
  console.error(
    "\n  This writes a test contact to the live CRM.\n" +
      "    node scripts/bd-contact-identity.mjs --confirm\n"
  );
  process.exit(1);
}

const { key, base } = loadEnv();

// Same mobile as the first test (0400000000), deliberately different email.
const contact = {
  first_name: "ZZ TEST",
  last_name: "Portal Identity",
  email: "zz.portal.identity@example.com",
  mobile: "0400000000",
};

process.stderr.write("  same mobile, different email…\n");

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

const id = body?.id ?? body?.contact?.id ?? body?.data?.id ?? null;
const DEDUP_ID = 5050; // the contact the first test produced

const verdict =
  id === null
    ? "Could not read an id — inspect the response below."
    : id === DEDUP_ID
    ? `MATCHED ON MOBILE. Same id (${id}) despite a different email — Box & Dice treats the mobile as an identifier too. Mobile can be the person's identity.`
    : `NEW CONTACT (${id}). A different email created a separate record even with the same mobile — EMAIL is the only key Box & Dice matches on.`;

console.log(JSON.stringify({ verdict, id, comparedAgainst: DEDUP_ID, status: res.status, body }, null, 2));
console.error(`\n  ${verdict}\n`);
