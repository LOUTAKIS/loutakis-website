// Shared helpers for the Box & Dice scripts.
//
// These run on YOUR machine, against .env.local (pulled with `vercel env pull`).
// That means no build, no commit, no deploy just to ask the CRM a question.
//
// Nothing here prints the API key.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export function loadEnv() {
  let text = "";
  for (const name of [".env.local", ".env"]) {
    try {
      text = readFileSync(join(here, "..", name), "utf8");
      break;
    } catch {}
  }
  if (!text) {
    console.error(
      "\n  No .env.local found. Run this once:\n\n    npx vercel link\n    npx vercel env pull .env.local\n"
    );
    process.exit(1);
  }

  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }

  // `vercel env pull` writes the literal string [SENSITIVE] for variables
  // stored as Secret type — they're write-only and can't be read back, even by
  // the CLI. Catch that here rather than failing later with a confusing URL error.
  const sealed = (v) => !v || v.includes("[SENSITIVE]");

  if (sealed(env.BOXDICE_API_KEY)) {
    console.error(
      "\n  BOXDICE_API_KEY came back as [SENSITIVE].\n\n" +
        "  Vercel stores it as a Secret, which is write-only — the CLI can't read it.\n" +
        "  Open .env.local and replace the two lines below with real values:\n\n" +
        '    BOXDICE_API_BASE="https://loutakis.boxdice.com.au/website_api"\n' +
        '    BOXDICE_API_KEY="<your Box & Dice Website API key>"\n\n' +
        "  The key comes from Box & Dice, not Vercel. If you generate a NEW key,\n" +
        "  the live site breaks until you update BOXDICE_API_KEY in Vercel too.\n"
    );
    process.exit(1);
  }

  let base = env.BOXDICE_API_BASE;
  if (sealed(base)) base = "https://loutakis.boxdice.com.au/website_api";

  return { key: env.BOXDICE_API_KEY, base: base.replace(/\/$/, "") };
}

export function headers(key, json = false) {
  return {
    Authorization: `Api-Key token=${key}`,
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Follow the timestamp pagination to the end, respecting Retry-After. */
export async function paginate(base, key, path) {
  let url = `${base}${path}`;
  const all = [];
  for (let i = 0; i < 50 && url; i++) {
    const res = await fetch(url, { headers: headers(key) });

    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") || 10) * 1000;
      process.stderr.write(`  rate limited, waiting ${wait / 1000}s…\n`);
      await sleep(wait);
      continue;
    }
    if (res.status === 204) break;
    if (!res.ok) throw new Error(`${path} -> ${res.status} ${res.statusText}`);

    const json = await res.json();
    const batch =
      (Array.isArray(json) && json) ||
      json.sales_listings ||
      json.contacts ||
      json.data ||
      Object.values(json).find(Array.isArray) ||
      [];
    if (!batch.length) break;

    all.push(...batch);
    // Cursor lives at paging.next per the API blueprint, not at the top level.
    url =
      (typeof json?.paging?.next === "string" && json.paging.next) ||
      (typeof json?.next === "string" && json.next) ||
      null;
  }
  return all;
}
