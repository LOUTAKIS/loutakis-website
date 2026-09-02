#!/usr/bin/env node
//
//   node scripts/bd-category-shapes.mjs 5052 --confirm
//
// WRITES to the contact you name — use a ZZ TEST one.
//
// Works out the payload shape that actually ASSIGNS a contact category.
//
// The earlier attempt returned 201 and applied nothing, so this verifies by
// reading the contact back after every attempt. A 2xx from this API does not
// mean the write took effect.

import { loadEnv, headers } from "./_bd.mjs";

const id = process.argv[2];
if (!id || !process.argv.includes("--confirm")) {
  console.error("\n  node scripts/bd-category-shapes.mjs <contact id> --confirm\n");
  process.exit(1);
}

const { key, base } = loadEnv();
const CATEGORY = "Off Market List - Pending";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The contact's own consultant_id — categories appear to be held per consultant.
await sleep(800);
const c0 = await (await fetch(`${base}/contacts/${id}`, { headers: headers(key) })).json();
const consultantId = c0?.contact?.consultant_id ?? 4;
console.error(`  contact ${id}, consultant_id ${consultantId}\n`);

// Category types, expanded, to find the type_id for our category.
await sleep(1500);
let typeId = null;
try {
  const res = await fetch(`${base}/contact_category_types?expand=true`, { headers: headers(key) });
  if (res.ok) {
    const types = await res.json();
    const match = (Array.isArray(types) ? types : types?.contact_category_types ?? []).find(
      (t) => (t?.name ?? t) === CATEGORY
    );
    typeId = match?.id ?? null;
    console.error(`  type_id for "${CATEGORY}": ${typeId ?? "not found"}\n`);
  } else {
    console.error(`  category types → ${res.status}\n`);
  }
} catch {}

const shapes = [
  { label: "objects with name", body: { categories: [{ name: CATEGORY }] } },
  { label: "objects with name + consultant_id", body: { categories: [{ name: CATEGORY, consultant_id: consultantId }] } },
  ...(typeId
    ? [
        { label: "objects with type_id", body: { categories: [{ type_id: typeId }] } },
        { label: "objects with type_id + consultant_id", body: { categories: [{ type_id: typeId, consultant_id: consultantId }] } },
      ]
    : []),
  { label: "contact_categories key", body: { contact_categories: [{ name: CATEGORY }] } },
  { label: "bare array", body: [{ name: CATEGORY }] },
];

for (const s of shapes) {
  await sleep(1500);
  const res = await fetch(`${base}/contacts/${id}/categories`, {
    method: "POST",
    headers: headers(key, true),
    body: JSON.stringify(s.body),
  });
  const text = (await res.text()).slice(0, 160).replace(/\s+/g, " ");

  // The only test that counts: is it on the contact now?
  await sleep(1200);
  const back = await (await fetch(`${base}/contacts/${id}`, { headers: headers(key) })).json();
  const cats = back?.contact?.categories ?? [];
  const applied = cats.some((x) => (x?.name ?? x) === CATEGORY);

  console.log(
    `${applied ? "✓ APPLIED" : "✗        "}  ${res.status}  ${s.label}\n` +
      `            ${JSON.stringify(s.body)}\n` +
      `            response: ${text || "(empty)"}  |  categories now: ${JSON.stringify(cats)}\n`
  );

  if (applied) {
    console.log(`\nUse this shape:\n  POST /contacts/{id}/categories\n  ${JSON.stringify(s.body)}\n`);
    process.exit(0);
  }
}

console.log("\nNone applied. Paste this output.\n");
