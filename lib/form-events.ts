import "server-only";
import { createClient } from "@vercel/global-config";

/**
 * Did the forms work? Counted by us, because Vercel won't.
 *
 * WHY THIS EXISTS. The site fires Vercel custom events on every form, and the
 * Website page was built to read them — but custom events are a Pro and
 * Enterprise feature. On Hobby they fire into nothing: neither the dashboard
 * nor the API can see them, which is why that page said "Couldn't load form
 * events" every time it was opened, for a month, about something that was
 * never going to load.
 *
 * The reason the panel was wanted still stands, and it is the only one that
 * matters: A FORM THAT FAILS SILENTLY IS A LEAD YOU NEVER HEAR ABOUT. Somebody
 * typed their name and their phone number, pressed send, saw an error, and went
 * to another agent. Nothing in the CRM records that it happened.
 *
 * So the count is kept here instead. Every form on this site already posts to a
 * route we own, which means the outcome is knowable server-side without
 * anyone's permission or plan. It costs nothing, it survives a change of host,
 * and it can say WHICH form failed — which Vercel's version could not.
 *
 * WHAT THIS DELIBERATELY DOES NOT HOLD. No names, no emails, no addresses, no
 * message text, no IP. Three integers per form per day and nothing else. It
 * cannot identify anybody, which is the only reason it is safe to keep a
 * running record of on a marketing site.
 */

const STORE_ID = process.env.GLOBAL_CONFIG_ID ?? "ecfg_y2dshgcsqthztqvi74jh0tqo1uzs";
const TEAM_ID = process.env.VERCEL_TEAM_ID ?? "team_P499DP8ocTP5k7vIJChVJiS1";
const API_TOKEN = process.env.VERCEL_API_TOKEN;
const client = process.env.GLOBAL_CONFIG ? createClient(process.env.GLOBAL_CONFIG) : null;

const KEY = "form_events";
/** Two months. Long enough to see a trend, short enough to stay small. */
const KEEP_DAYS = 60;

/**
 * The forms worth counting, and the names they are counted under.
 *
 * A closed list rather than free text: the client can ask to record a "started"
 * and anything it sends is checked against this, so a stray request cannot
 * invent a form or fill the store with rubbish.
 */
export const FORMS = {
  enquiry: "Property enquiry",
  appraisal: "Appraisal request",
  register: "Off-market registration",
  "portal-enquiry": "Off-market enquiry",
  questionnaire: "Property information",
} as const;

export type FormName = keyof typeof FORMS;
export type Outcome = "started" | "sent" | "failed";

export function isFormName(v: unknown): v is FormName {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(FORMS, v);
}

type Counts = { started: number; sent: number; failed: number };
type Store = { days: Record<string, Partial<Record<FormName, Partial<Counts>>>> };

/** Melbourne's date, not UTC's — a 9pm enquiry belongs to that evening. */
function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function read(): Promise<Store> {
  const empty: Store = { days: {} };
  if (API_TOKEN) {
    try {
      const res = await fetch(
        `https://api.vercel.com/v1/global-config/${STORE_ID}/item/${KEY}?teamId=${encodeURIComponent(TEAM_ID)}`,
        { headers: { Authorization: `Bearer ${API_TOKEN}` }, cache: "no-store" }
      );
      if (res.ok) {
        // An empty 200 is how a key that has never been written comes back, and
        // res.json() throws on it. See the same note in campaigns.ts.
        const text = await res.text();
        if (!text.trim()) return empty;
        const json: any = JSON.parse(text);
        const v = json?.value;
        return v && typeof v === "object" && v.days ? (v as Store) : empty;
      }
      if (res.status !== 404) console.error(`[form-events] REST read -> ${res.status}`);
    } catch (err) {
      console.error("[form-events] REST read failed", err);
    }
  }
  if (!client) return empty;
  try {
    const v = await client.get<Store>(KEY);
    return v && v.days ? v : empty;
  } catch (err) {
    console.error("[form-events] SDK read failed", err);
    return empty;
  }
}

async function write(store: Store): Promise<void> {
  if (!API_TOKEN) return;
  const res = await fetch(
    `https://api.vercel.com/v1/global-config/${STORE_ID}/items?teamId=${encodeURIComponent(TEAM_ID)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ operation: "upsert", key: KEY, value: store }] }),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`form-events write -> ${res.status} ${await res.text()}`);
}

/**
 * Count one thing that happened to one form.
 *
 * READ-MODIFY-WRITE, AND THAT IS A DELIBERATE CHOICE. Two submissions in the
 * same second could lose one of the increments. At this volume — a handful of
 * enquiries a day across the whole site — that will effectively never happen,
 * and the cost if it does is one number being one too low on a dashboard. The
 * alternative is a key per form per day, which is forty times the keys in a
 * store that is rate-limited, to protect a count that nobody is auditing.
 *
 * NEVER THROWS, NEVER BLOCKS. A failure to count must not fail the thing being
 * counted — losing an enquiry because the analytics store was busy would be a
 * far worse bug than the one this was built to catch. Callers should not await
 * this ahead of their response.
 */
export async function recordFormEvent(form: FormName, outcome: Outcome): Promise<void> {
  try {
    const store = await read();
    const date = today();
    const day = (store.days[date] ??= {});
    const counts = (day[form] ??= {});
    counts[outcome] = (counts[outcome] ?? 0) + 1;

    // Prune here rather than on a schedule: it is the only write path, so the
    // store cannot grow while nobody is looking.
    const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
    for (const d of Object.keys(store.days)) if (d < cutoff) delete store.days[d];

    await write(store);
  } catch (err) {
    console.error(`[form-events] could not record ${form}/${outcome}`, err);
  }
}

export type FormRow = { form: FormName; label: string } & Counts;
export type FormStats = {
  totals: Counts;
  rows: FormRow[];
  /** Only the forms that actually failed, so the panel can lead with them. */
  failing: FormRow[];
  since: string;
  /** False when nothing has been recorded yet — a new store, not a broken one. */
  any: boolean;
};

export async function getFormStats(days = 30): Promise<FormStats> {
  const store = await read();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const acc = new Map<FormName, Counts>();
  for (const [date, forms] of Object.entries(store.days)) {
    if (date < cutoff) continue;
    for (const [form, counts] of Object.entries(forms)) {
      if (!isFormName(form)) continue;
      const a = acc.get(form) ?? { started: 0, sent: 0, failed: 0 };
      a.started += counts?.started ?? 0;
      a.sent += counts?.sent ?? 0;
      a.failed += counts?.failed ?? 0;
      acc.set(form, a);
    }
  }

  const rows: FormRow[] = [...acc.entries()]
    .map(([form, c]) => ({ form, label: FORMS[form], ...c }))
    .sort((a, b) => b.failed - a.failed || b.sent - a.sent);

  const totals = rows.reduce<Counts>(
    (t, r) => ({
      started: t.started + r.started,
      sent: t.sent + r.sent,
      failed: t.failed + r.failed,
    }),
    { started: 0, sent: 0, failed: 0 }
  );

  return {
    totals,
    rows,
    failing: rows.filter((r) => r.failed > 0),
    since: cutoff,
    any: rows.length > 0,
  };
}
