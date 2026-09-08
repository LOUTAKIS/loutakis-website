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
