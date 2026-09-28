import "server-only";
import { createClient } from "@vercel/global-config";

/**
 * Did the forms work, and where do people give up?
 *
 * WHY THIS EXISTS. The site fires Vercel custom events on every form, and the
 * Website page was built to read them — but custom events are a Pro and
 * Enterprise feature. On Hobby they fire into nothing, which is why that page
 * said "Couldn't load form events" every time it was opened, for a month,
 * about something that was never going to load.
 *
 * The reason the panel was wanted still stands, and it is the only one that
 * matters: A FORM THAT FAILS SILENTLY IS A LEAD YOU NEVER HEAR ABOUT. Somebody
 * typed their name and their phone number, pressed send, saw an error, and went
 * to another agent. Nothing in the CRM records that it happened.
 *
 * So the count is kept here instead. Every form on this site already posts to a
 * route we own, which means the outcome is knowable server-side without
 * anyone's permission or plan.
 *
 * WHAT THIS DELIBERATELY DOES NOT HOLD. No names, no emails, no addresses, no
 * message text, no IP. Counts, a field id, a duration in seconds, and the hour
 * of the day. The one piece that comes close is WHICH FIELD someone was on when
 * they left — the field's name, never what they had typed in it. It cannot
 * identify anybody, which is the only reason it is safe to keep on a marketing
 * site.
 */

const STORE_ID = process.env.GLOBAL_CONFIG_ID ?? "ecfg_y2dshgcsqthztqvi74jh0tqo1uzs";
const TEAM_ID = process.env.VERCEL_TEAM_ID ?? "team_P499DP8ocTP5k7vIJChVJiS1";
const API_TOKEN = process.env.VERCEL_API_TOKEN;
const client = process.env.GLOBAL_CONFIG ? createClient(process.env.GLOBAL_CONFIG) : null;

const KEY = "form_events";
/** Two months. Long enough to see a trend, short enough to stay small. */
const KEEP_DAYS = 60;
/** Enough samples for an honest median without the record growing forever. */
const KEEP_DURATIONS = 60;

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

/** Everything about one form that isn't a daily count. */
type Detail = {
  /** Field id → how many people were last on it when they left. */
  abandon?: Record<string, number>;
  /** Seconds from first keystroke to send, most recent first. */
  durations?: number[];
  /** Melbourne hour of the day, 0–23, when a form was sent. */
  hours?: number[];
  /** Melbourne day of the week, 0 = Sunday, when a form was sent. */
  dows?: number[];
};

type Store = {
  days: Record<string, Partial<Record<FormName, Partial<Counts>>>>;
  detail?: Partial<Record<FormName, Detail>>;
  /** Box & Dice listing id → enquiries received about it. */
  listings?: Record<string, number>;
};

/** Melbourne's date, not UTC's — a 9pm enquiry belongs to that evening. */
const MELBOURNE = "Australia/Melbourne";

function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MELBOURNE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** The hour and weekday in Melbourne, which is where the person filling it in is. */
function melbourneWhen(): { hour: number; dow: number } {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE,
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dow = Math.max(0, names.indexOf(parts.find((p) => p.type === "weekday")?.value ?? "Sun"));
  return { hour, dow };
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

function prune(store: Store) {
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
  for (const d of Object.keys(store.days)) if (d < cutoff) delete store.days[d];
}

/**
 * Every write goes through here.
 *
 * READ-MODIFY-WRITE, AND THAT IS A DELIBERATE CHOICE. Two submissions in the
 * same second could lose one increment. At a handful of enquiries a day that
 * will effectively never happen, and the cost if it does is one number being
 * one too low on a dashboard. The alternative is a key per form per day, which
 * is forty times the keys in a rate-limited store, to protect a count nobody
 * is auditing.
 *
 * NEVER THROWS, NEVER BLOCKS. A failure to count must not fail the thing being
 * counted — losing an enquiry because the analytics store was busy would be far
 * worse than the bug this was built to catch. Callers should not await it ahead
 * of their response.
 */
async function edit(fn: (store: Store) => void): Promise<void> {
  try {
    const store = await read();
    fn(store);
    prune(store);
    await write(store);
  } catch (err) {
    console.error("[form-events] write failed", err);
  }
}

function detailOf(store: Store, form: FormName): Detail {
  store.detail ??= {};
  store.detail[form] ??= {};
  return store.detail[form]!;
}

/** Count one thing that happened to one form. */
export async function recordFormEvent(form: FormName, outcome: Outcome): Promise<void> {
  await edit((store) => {
    const date = today();
    const day = (store.days[date] ??= {});
    const counts = (day[form] ??= {});
    counts[outcome] = (counts[outcome] ?? 0) + 1;

    // When it was sent, in the sender's own time. Recorded server-side because
    // it is a fact about when we received it, not a claim from a browser.
    if (outcome === "sent") {
      const d = detailOf(store, form);
      const { hour, dow } = melbourneWhen();
      d.hours = d.hours?.length === 24 ? d.hours : new Array(24).fill(0);
      d.dows = d.dows?.length === 7 ? d.dows : new Array(7).fill(0);
      d.hours[hour] += 1;
      d.dows[dow] += 1;
    }
  });
}

/**
 * They were filling this in and left. `field` is the id of the last one they
 * touched — never what they typed in it.
 */
export async function recordAbandon(form: FormName, field: string): Promise<void> {
  const key = String(field).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
  if (!key) return;
  await edit((store) => {
    const d = detailOf(store, form);
    d.abandon ??= {};
    d.abandon[key] = (d.abandon[key] ?? 0) + 1;
  });
}

/** How long a completed form took, in seconds. */
export async function recordDuration(form: FormName, seconds: number): Promise<void> {
  // An hour-long form is a tab left open over lunch, not a form that took an
  // hour; anything past that says nothing about the form's length.
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 3600) return;
  await edit((store) => {
    const d = detailOf(store, form);
    d.durations = [Math.round(seconds), ...(d.durations ?? [])].slice(0, KEEP_DURATIONS);
  });
}

/** An enquiry about one property. The CRM's listing id, nothing about the person. */
export async function recordListingEnquiry(listingId: number | string): Promise<void> {
  const id = String(listingId).replace(/\D/g, "");
  if (!id) return;
  await edit((store) => {
    store.listings ??= {};
    store.listings[id] = (store.listings[id] ?? 0) + 1;
  });
}

export type FormRow = { form: FormName; label: string } & Counts & {
    /** Median seconds to complete, or null when too few have been timed. */
    medianSeconds: number | null;
    /** Where people gave up, worst first. */
    abandon: { field: string; count: number }[];
  };

export type FormStats = {
  totals: Counts;
  rows: FormRow[];
  /** Only the forms that actually failed, so the panel can lead with them. */
  failing: FormRow[];
  /** Sends by Melbourne hour, 0–23. Null when nothing has been sent. */
  hours: number[] | null;
  /** Sends by weekday, 0 = Sunday. */
  dows: number[] | null;
  /** Listing id → enquiries, for the properties table. */
  byListing: Record<string, number>;
  since: string;
  any: boolean;
};

function median(xs: number[]): number | null {
  if (xs.length < 3) return null; // Two samples is an anecdote, not a median.
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

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
    .map(([form, c]) => {
      const d = store.detail?.[form] ?? {};
      return {
        form,
        label: FORMS[form],
        ...c,
        medianSeconds: median(d.durations ?? []),
        abandon: Object.entries(d.abandon ?? {})
          .map(([field, count]) => ({ field, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      };
    })
    .sort((a, b) => b.failed - a.failed || b.sent - a.sent);

  const totals = rows.reduce<Counts>(
    (t, r) => ({
      started: t.started + r.started,
      sent: t.sent + r.sent,
      failed: t.failed + r.failed,
    }),
    { started: 0, sent: 0, failed: 0 }
  );

  /**
   * Hours and weekdays are lifetime rather than windowed. They answer "when do
   * people enquire", which is a habit and wants every sample it can get — and
   * at this volume a 30-day slice would be too thin to show a shape.
   */
  const hours = new Array(24).fill(0);
  const dows = new Array(7).fill(0);
  let timed = 0;
  for (const d of Object.values(store.detail ?? {})) {
    (d?.hours ?? []).forEach((n, i) => (hours[i] += n));
    (d?.dows ?? []).forEach((n, i) => (dows[i] += n));
    timed += (d?.hours ?? []).reduce((a, b) => a + b, 0);
  }

  return {
    totals,
    rows,
    failing: rows.filter((r) => r.failed > 0),
    hours: timed ? hours : null,
    dows: timed ? dows : null,
    byListing: store.listings ?? {},
    since: cutoff,
    any: rows.length > 0,
  };
}
