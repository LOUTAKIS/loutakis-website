#!/usr/bin/env node
//
//   node scripts/store-check.mjs
//
// Read-only. Confirms the Global Config store is reachable with the pulled
// connection string, and shows how many lookup entries it holds. Writes can
// only be tested on Vercel (the API token is sealed locally), so a successful
// registration on the deployed site is the write test.

import { readFileSync } from "node:fs";
import { createClient } from "@vercel/global-config";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const cs = env.GLOBAL_CONFIG;
if (!cs || cs.includes("[SENSITIVE]")) {
  console.error("\n  GLOBAL_CONFIG missing from .env.local — run: npx vercel env pull .env.local --environment=production\n");
  process.exit(1);
}

const client = createClient(cs);
const all = await client.getAll();
const keys = Object.keys(all ?? {});

console.log(
  JSON.stringify(
    {
      reachable: true,
      entries: keys.length,
      byEmail: keys.filter((k) => k.startsWith("e_")).length,
      byMobile: keys.filter((k) => k.startsWith("m_")).length,
      // Keys are hashes, so this reveals nothing about anyone.
      sample: keys.slice(0, 3),
    },
    null,
    2
  )
);
