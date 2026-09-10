/**
 * Dates and times, always in Melbourne.
 *
 * THE TIMEZONE IS NOT OPTIONAL. These strings are rendered on the server, and
 * Vercel's servers run in UTC — so a `toLocaleString` without an explicit zone
 * silently advertises a Saturday 11am open at 1am. Every formatter here pins
 * Australia/Melbourne, which is the only timezone this agency sells in.
 */

const TZ = "Australia/Melbourne";

const DATE: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: TZ,
};

const TIME: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  timeZone: TZ,
};

/**
 * How far ahead of UTC Melbourne is at a given instant, in milliseconds.
 * +10h for AEST, +11h during daylight saving — asked of the runtime rather
 * than hard-coded, because the changeover dates move every year.
 */
function zoneOffsetMs(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));

  const p: Record<string, string> = {};
  for (const { type, value } of parts) p[type] = value;

  // `hour` can come back as "24" for midnight in some runtimes.
  const asIfUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asIfUTC - instant;
}

/**
 * Turn Box & Dice's date and time into a real instant.
 *
 * THIS IS THE BUG THAT PUT A 12PM OPEN ON THE SITE AS 10PM. The CRM stores
 * wall-clock time with no zone at all — inspection_date "2026-09-12",
 * start_time "12:00" — meaning midday in Melbourne, where the house is. Joining
 * them into "2026-09-12T12:00" produces a floating time, and `new Date` reads a
 * floating time in the server's own zone. Vercel's servers run in UTC, so
 * midday became midday UTC: ten hours out, and eleven during daylight saving.
 *
 * So the wall clock is anchored to Melbourne explicitly. The offset is applied
 * twice on purpose: the first pass uses the offset at the wrong instant, which
 * lands an hour out on the two days a year the clocks change, and the second
 * corrects it.
 */
export function melbourneTime(date?: string | null, time?: string | null): string {
  if (!date) return "";
  const [y, m, d] = String(date).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";

  const [hh = 0, mm = 0] = String(time ?? "00:00").split(":").map(Number);
  if (isNaN(hh) || isNaN(mm)) return "";

  const wallAsUTC = Date.UTC(y, m - 1, d, hh, mm);
  const firstGuess = wallAsUTC - zoneOffsetMs(wallAsUTC);
  const instant = wallAsUTC - zoneOffsetMs(firstGuess);
  return new Date(instant).toISOString();
}

function valid(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(+d) ? null : d;
}

/** "11:00am" — lowercase, no space, the way a property ad writes it. */
function time(d: Date): string {
  return d.toLocaleString("en-AU", TIME).replace(/\s*(am|pm)/i, (_, x) => x.toLowerCase());
}

/** "Sat 13 Sep, 11:00am" — a single moment, for an auction. */
/**
 * "10-09-2026". The house format for a plain date, everywhere.
 *
 * Australian order — never the American one, and never the ISO one the CRM and
 * the analytics API happen to speak. Those are wire formats: a person reading
 * "2026-08-11" has to stop and work out which half is the month.
 *
 * Returns the input untouched if it cannot be parsed, because a wrong date is
 * worse than an unformatted one.
 */
export function fmtDate(value?: string | Date | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(+d)) return String(value);
  const p = (n: number) => String(n).padStart(2, "0");
  /**
   * UTC parts, deliberately. A plain "2026-08-11" parses as midnight UTC, and
   * reading it back in Melbourne time would print the 11th as the 11th in
   * winter and the 12th at some times of year. These are dates, not moments.
   */
  return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
}

export function fmtMoment(iso?: string | null): string {
  const d = valid(iso);
  if (!d) return "";
  return `${d.toLocaleString("en-AU", DATE)}, ${time(d)}`;
}

/**
 * "Sat 13 Sep, 11:00 – 11:30am" — an inspection, with its end time.
 *
 * Buyers plan a Saturday around how long each open runs, so the end time is not
 * decoration. When both times share a meridiem the first one drops it, which is
 * how every real estate ad in the country sets it and reads far better than
 * "11:00am – 11:30am".
 *
 * Falls back to the start alone if the end is missing or not after the start —
 * a wrong range is worse than no range.
 */
export function fmtInspection(start?: string | null, end?: string | null): string {
  const s = valid(start);
  if (!s) return "";
  const e = valid(end);
  const date = s.toLocaleString("en-AU", DATE);
  if (!e || +e <= +s) return `${date}, ${time(s)}`;

  const st = time(s);
  const et = time(e);
  const sameHalf = st.slice(-2) === et.slice(-2);
  return `${date}, ${sameHalf ? st.slice(0, -2) : st} – ${et}`;
}
