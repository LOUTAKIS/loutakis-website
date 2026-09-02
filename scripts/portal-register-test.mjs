#!/usr/bin/env node
//
//   node scripts/portal-register-test.mjs --confirm
//
// WRITES. Exercises the registration path end to end against the live CRM,
// without a browser or a deploy: create contact → assign pending category →
// write the answers to the timeline.
//
// Checks the three things that actually matter:
//   1. the contact is created
//   2. the pending category sticks
//   3. marketing consent is FALSE, not the API's opted-in default
//
// Creates "ZZ TEST Registration". Delete it afterwards.

import { loadEnv, headers } from "./_bd.mjs";

if (!process.argv.includes("--confirm")) {
  console.error("\n  node scripts/portal-register-test.mjs --confirm\n");
  process.exit(1);
}

const { key, base } = loadEnv();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PENDING = "Off Market List - Pending";

const post = async (path, body) => {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: headers(key, true),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text.slice(0, 300);
  }
  return { status: res.status, body: parsed };
};

// 1. Create the contact — consent explicitly false, as a real registration
//    would be for someone who didn't tick the box.
console.error("  creating contact…");
const created = await post("/contacts", {
  contact: {
    first_name: "ZZ TEST",
    last_name: "Registration",
    email: "zz.portal.registration@example.com",
    mobile: "0422222222",
    permit_email_campaign: false,
    permit_sms: false,
  },
});
const id = created.body?.id ?? created.body?.contact?.id;
console.error(`  contact ${id} (${created.status})`);
if (!id) {
  console.log(JSON.stringify(created, null, 2));
  process.exit(1);
}

// 2. Pending category. Categories are per consultant, so consultant_id is
//    required — without it the API 404s, and an array of plain strings returns
//    201 while applying nothing.
await sleep(1200);
const owner = await (await fetch(`${base}/contacts/${id}`, { headers: headers(key) })).json();
const consultantId = owner?.contact?.consultant_id;

await sleep(1200);
console.error(`  assigning pending category (consultant ${consultantId})…`);
const cat = await post(`/contacts/${id}/categories`, {
  categories: [{ name: PENDING, consultant_id: consultantId }],
});
console.error(`  ${cat.status}`);

// 3. Timeline note — path undocumented, so try both candidates.
await sleep(1500);
console.error("  writing timeline note…");
let notePath = null;
for (const p of [`/contacts/${id}/notes`, `/contacts/${id}/comments`]) {
  const r = await post(p, {
    note: { text: "Registered for the off-market list on the website." },
    comment: { text: "Registered for the off-market list on the website." },
    text: "Registered for the off-market list on the website.",
  });
  console.error(`    ${p} → ${r.status}`);
  if (r.status < 400) {
    notePath = p;
    break;
  }
  await sleep(1500);
}

// 4. Read it back and check what actually stuck.
await sleep(1500);
const res = await fetch(`${base}/contacts/${id}`, { headers: headers(key) });
const c = (await res.json())?.contact ?? {};

const consentOk = c.permit_email_campaign === false && c.permit_sms === false;
const categoryOk = (c.categories ?? []).some((x) => (x.name ?? x) === PENDING);

console.log(
  JSON.stringify(
    {
      contactId: id,
      notePathThatWorked: notePath,
      checks: {
        consentIsFalse: consentOk,
        pendingCategoryApplied: categoryOk,
        noteWritten: Boolean(notePath),
      },
      stored: {
        permit_email_campaign: c.permit_email_campaign,
        permit_sms: c.permit_sms,
        categories: c.categories,
        comments: (c.comments ?? []).map((x) => x.text),
      },
    },
    null,
    2
  )
);

console.error(
  `\n  consent false: ${consentOk ? "yes" : "NO — the API default won"}` +
    `\n  pending category: ${categoryOk ? "yes" : "NO"}` +
    `\n  Clean up: delete contact ${id} ("ZZ TEST Registration") in Box & Dice.\n`
);
