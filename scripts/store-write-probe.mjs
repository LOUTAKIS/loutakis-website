#!/usr/bin/env node
//
//   node scripts/store-write-probe.mjs
//
// Diagnoses Global Config writes step by step with VERCEL_API_TOKEN from
// .env.local: can the token see the store at all, then create / upsert /
// delete one throwaway key. Prints every status and body. Leaves nothing behind.

import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const TOKEN = env.VERCEL_API_TOKEN;
const STORE_ID = env.GLOBAL_CONFIG_ID ?? "ecfg_y2dshgcsqthztqvi74jh0tqo1uzs";
const TEAM_ID = env.VERCEL_TEAM_ID ?? "team_P499DP8ocTP5k7vIJChVJiS1";

if (!TOKEN || TOKEN.includes("[SENSITIVE]")) {
  console.error("\n  VERCEL_API_TOKEN is not readable in .env.local — paste it in first.\n");
  process.exit(1);
}

const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

async function call(label, url, init) {
  const res = await fetch(url, { ...init, headers: H });
  const text = await res.text();
  console.log(`\n${label}\n  ${init?.method ?? "GET"} ${url.replace(TEAM_ID, "<team>")}\n  -> ${res.status} ${text.slice(0, 300)}`);
  return res;
}

const base = "https://api.vercel.com/v1/global-config";
const q = `teamId=${encodeURIComponent(TEAM_ID)}`;
const key = "probe_delete_me";
const patch = (items) => ({ method: "PATCH", body: JSON.stringify({ items }) });

// 1. Who is this token? Which teams can it see?
await call("1. token identity", "https://api.vercel.com/v2/user");
await call("2. teams visible to token", "https://api.vercel.com/v2/teams");

// 3. Can it see the store — with and without the team scope?
await call("3a. store metadata (team scoped)", `${base}/${STORE_ID}?${q}`);
await call("3b. store metadata (no team)", `${base}/${STORE_ID}`);

// 4. Write operations, one at a time.
await call("4a. create", `${base}/${STORE_ID}/items?${q}`, patch([{ operation: "create", key, value: 1 }]));
await call("4b. upsert", `${base}/${STORE_ID}/items?${q}`, patch([{ operation: "upsert", key, value: 2 }]));
await call("4c. delete", `${base}/${STORE_ID}/items?${q}`, patch([{ operation: "delete", key }]));
