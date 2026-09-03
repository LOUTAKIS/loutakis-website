import "server-only";
import raw from "./suburbs-vic.json";

/**
 * Victorian suburbs, name → Box & Dice suburb id.
 *
 * Built once by scripts/bd-suburbs.mjs and committed, because /suburbs is the
 * whole of Australia behind a 10-second-per-page rate limit — not something to
 * call while a buyer waits. Re-run that script only if Box & Dice adds suburbs.
 *
 * Keys are "NAME|POSTCODE" because suburb names repeat across postcodes
 * (there are several Hillsides in Victoria), and the pair is what makes a
 * choice unambiguous for both the buyer and the CRM.
 */

export type Suburb = { id: number; name: string; postcode: string };

const MAP = raw as Record<string, number>;

const ALL: Suburb[] = Object.entries(MAP)
  .map(([key, id]) => {
    const [name, postcode] = key.split("|");
    return { id, name: titleCase(name), postcode: postcode ?? "" };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (m) => m.toUpperCase());
}

/**
 * Prefix matches first, then anything containing the term — so typing "foot"
 * puts Footscray above West Footscray, which is what someone means.
 */
export function searchSuburbs(query: string, limit = 8): Suburb[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const starts: Suburb[] = [];
  const contains: Suburb[] = [];

  for (const s of ALL) {
    const name = s.name.toLowerCase();
    if (name.startsWith(q)) starts.push(s);
    else if (name.includes(q) || s.postcode.startsWith(q)) contains.push(s);
    if (starts.length >= limit) break;
  }

  return [...starts, ...contains].slice(0, limit);
}

/** Keep only ids that really exist, so nothing invented reaches the CRM. */
export function validSuburbIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) return [];
  const known = new Set(Object.values(MAP));
  return ids
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && known.has(n))
    .slice(0, 12);
}

/** For the CRM note and the office email — ids mean nothing to a human. */
export function namesForIds(ids: number[]): string[] {
  const byId = new Map(ALL.map((s) => [s.id, s]));
  return ids.map((id) => byId.get(id)?.name).filter(Boolean) as string[];
}
