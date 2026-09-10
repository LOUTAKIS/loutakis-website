import "server-only";

/**
 * Website numbers for the staff dashboard, read from Vercel's Web Analytics
 * API — the same aggregated data the Vercel dashboard shows, queried with the
 * token this project already holds.
 *
 * WHAT THIS CANNOT TELL YOU: time on site. Vercel Web Analytics records page
 * views and visitors, not session duration or bounce rate, so no amount of
 * querying will produce a "average time spent" figure. Anything claiming to be
 * one would be invented, so the page does not show one.
 *
 * WHAT IT CAN: visitors and page views over a window, the same for the window
 * before it, which pages and which referrers, and our own four form events —
 * started, submitted, succeeded, failed. That last one is the useful one: a
 * rising `failed` count is an outage a buyer would otherwise have to tell us
 * about.
 *
 * Nothing here is personal. The API returns counts, and our events carry only
 * which form and what happened (see lib/track).
 */

const API = "https://api.vercel.com/v1/query/web-analytics";

/**
 * Team id defaults to the same constant as the portal store — this is the
 * Loutakis team, not a secret, and hard-coding the fallback means one missing
 * env var doesn't silently blank the page.
 */
const TEAM_ID = process.env.VERCEL_TEAM_ID ?? "team_P499DP8ocTP5k7vIJChVJiS1";
const PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const TOKEN = process.env.VERCEL_API_TOKEN;

export function analyticsConfigured(): boolean {
  return Boolean(TOKEN && PROJECT_ID);
}

export type Totals = { visitors: number; pageviews: number };
export type DayPoint = { date: string; visitors: number; pageviews: number };
export type NamedCount = { name: string; visitors: number; pageviews: number };
export type Funnel = { started: number; submitted: number; succeeded: number; failed: number };

export type SiteStats = {
  since: string;
  until: string;
  totals: Totals;
  /** The equally long window immediately before, for the change line. */
  previous: Totals | null;
  daily: DayPoint[];
  topPages: NamedCount[];
  referrers: NamedCount[];
  funnel: Funnel | null;
  /** Views of /listings — see the query. Null when that read failed. */
  qrScans: Totals | null;
  /** Which parts failed, so the page can say so rather than show a zero. */
  missing: string[];
};

/** YYYY-MM-DD, which is what the API's `since`/`until` want. */
function day(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/**
 * One query. Returns null rather than throwing: a dashboard that renders four
 * numbers out of five is more useful than one that renders an error, and the
 * caller records what was missing.
 */
async function query(path: string, params: Record<string, string | number | undefined>): Promise<any | null> {
  if (!analyticsConfigured()) return null;

  const url = new URL(`${API}/${path}`);
  url.searchParams.set("teamId", TEAM_ID);
  url.searchParams.set("projectId", String(PROJECT_ID));
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
      // Fifteen minutes. These numbers are read between phone calls, not by the
      // second, and every staff page view would otherwise be five API calls.
      next: { revalidate: 900, tags: ["web-analytics"] },
    });
    if (!res.ok) {
      console.error(`[web-analytics] ${path} → ${res.status} ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[web-analytics] ${path} failed`, err);
    return null;
  }
}

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

function sum(rows: any[]): Totals {
  return {
    visitors: rows.reduce((t, r) => t + num(r?.visitors), 0),
    pageviews: rows.reduce((t, r) => t + num(r?.pageviews), 0),
  };
}

/**
 * Rows come back keyed by whichever dimension was grouped on, and the docs
 * show at least one endpoint returning it as a plain `eventData` key rather
 * than the property name. So take the first string value that isn't a
 * timestamp instead of guessing the key.
 */
function nameOf(row: any, preferred: string): string {
  const direct = row?.[preferred];
  if (typeof direct === "string" && direct) return direct;
  for (const [k, v] of Object.entries(row ?? {})) {
    if (k === "timestamp") continue;
    if (typeof v === "string" && v) return v;
  }
  return "—";
}

function named(json: any, key: string, limit: number, blankAs = "—"): NamedCount[] {
  const rows: any[] = Array.isArray(json?.data) ? json.data : [];
  return rows
    .map((r) => {
      const name = nameOf(r, key);
      return {
        name: name === "—" ? blankAs : name,
        visitors: num(r?.visitors),
        pageviews: num(r?.pageviews),
      };
    })
    .sort((a, b) => b.pageviews - a.pageviews || b.visitors - a.visitors)
    .slice(0, limit);
}

export async function getSiteStats(days = 30): Promise<SiteStats | null> {
  if (!analyticsConfigured()) return null;

  const until = day(daysAgo(0));
  const since = day(daysAgo(days));
  const prevUntil = day(daysAgo(days + 1));
  const prevSince = day(daysAgo(days * 2 + 1));

  /**
   * The four form events, one query each, filtered by name.
   *
   * Grouping by `eventName` was the obvious way to do this in one call and it
   * failed against the live API — the documented dimensions for the events
   * dataset are eventData/<property> and flags/<name>, and eventName appears
   * only as something to FILTER on. Four small queries that work beat one
   * elegant one that doesn't.
   */
  const EVENTS = ["form_started", "form_submitted", "form_succeeded", "form_failed"] as const;

  const [daily, prior, pages, refs, qr, ...eventResults] = await Promise.all([
    query("visits/aggregate", { since, until, by: "day" }),
    query("visits/aggregate", { since: prevSince, until: prevUntil, by: "day" }),
    query("visits/aggregate", { since, until, by: "requestPath", limit: 12 }),
    query("visits/aggregate", { since, until, by: "referrerHostname", limit: 6 }),
    /**
     * QR SCANS FROM THE BOARDS AND BROCHURES.
     *
     * The printed codes point at /listings, which 308-redirects to /properties
     * — but Vercel still records the requested path, so views of /listings are
     * scans. Nobody types that URL: it has not been a page on this site since
     * before the rebuild, and nothing links to it. Its only remaining source is
     * a phone camera pointed at a board.
     */
    query("visits/aggregate", { since, until, by: "day", filter: `requestPath eq '/listings'` }),
    ...EVENTS.map((name) =>
      query("events/aggregate", { since, until, by: "day", filter: `eventName eq '${name}'` })
    ),
  ]);

  const missing: string[] = [];
  if (!daily) missing.push("visitors");
  if (!pages) missing.push("top pages");
  if (!refs) missing.push("referrers");
  if (eventResults.every((r) => !r)) missing.push("form events");
  /**
   * A missing previous period is not worth reporting. On Hobby the reporting
   * window is shorter than sixty days, so the comparison simply isn't there
   * yet — the page drops the change line and says nothing, rather than
   * claiming a fault.
   */

  const dailyRows: any[] = Array.isArray(daily?.data) ? daily.data : [];

  /**
   * `visitors` rather than `count` for started, submitted and succeeded: one
   * person hammering the button is one enquiry, not four. `failed` uses count,
   * because every failure is a separate thing that went wrong.
   */
  const tally = (i: number, field: "visitors" | "count") => {
    const rows: any[] = Array.isArray(eventResults[i]?.data) ? eventResults[i].data : [];
    return rows.reduce((t, r) => t + num(r?.[field]), 0);
  };

  return {
    since,
    until,
    totals: sum(dailyRows),
    previous: prior ? sum(Array.isArray(prior.data) ? prior.data : []) : null,
    daily: dailyRows.map((r) => ({
      date: String(r?.timestamp ?? "").slice(0, 10),
      visitors: num(r?.visitors),
      pageviews: num(r?.pageviews),
    })),
    topPages: pages ? named(pages, "requestPath", 8) : [],
    /**
     * An empty referrer hostname means there wasn't one: typed in, opened from
     * a bookmark, scanned off a board, or followed from an app that strips the
     * referrer. That is "Direct", and it is usually the largest row — showing
     * it as a dash made the most important number on the page unreadable.
     */
    referrers: refs ? named(refs, "referrerHostname", 6, "Direct") : [],
    funnel: eventResults.some((r) => r)
      ? {
          started: tally(0, "visitors"),
          submitted: tally(1, "visitors"),
          succeeded: tally(2, "visitors"),
          failed: tally(3, "count"),
        }
      : null,
    qrScans: qr ? sum(Array.isArray(qr.data) ? qr.data : []) : null,
    missing,
  };
}
