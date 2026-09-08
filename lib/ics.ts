/**
 * Calendar events for inspections and auctions.
 *
 * The point is not the event, it is the ALARM inside it. A buyer who adds
 * Saturday's open to their phone gets a reminder an hour before from their own
 * calendar — no phone number collected, no SMS provider, no consent question,
 * and it works on every phone ever made. Inspection numbers are what a vendor
 * judges week one on, so this is the cheapest lift available to a campaign.
 *
 * Written against RFC 5545. The awkward parts are all deliberate:
 *   - times are emitted in UTC (a trailing Z) so no client has to agree with us
 *     about what "Australia/Melbourne" means,
 *   - text is escaped, because an address with a comma in it silently truncates
 *     the field otherwise,
 *   - lines are folded at 75 octets, which Outlook still enforces.
 */

export type CalendarEvent = {
  /** Stable per listing and per occurrence, so re-adding updates rather than duplicates. */
  uid: string;
  start: string;
  end?: string;
  title: string;
  description?: string;
  location?: string;
  url?: string;
  /** Minutes before the start to alarm. Omit for no alarm. */
  remindMinutes?: number;
};

/** RFC 5545 escaping: backslash, semicolon, comma, newline. Order matters. */
function esc(text: string): string {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** 20260912T020000Z */
function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Fold to 75 octets, continuation lines starting with a single space.
 * Counted in BYTES, not characters — an address with a non-ASCII character in
 * it would otherwise fold in the wrong place and corrupt the file.
 */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let cut = 0;
  while (cut < bytes.length) {
    const take = cut === 0 ? 75 : 74; // continuations lose one octet to the space
    let end = Math.min(cut + take, bytes.length);
    // Never split a multi-byte character: back up off any continuation byte.
    while (end > cut && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push((cut === 0 ? "" : " ") + bytes.subarray(cut, end).toString("utf8"));
    cut = end;
  }
  return out.join("\r\n");
}

export function buildIcs(event: CalendarEvent): string {
  const now = stamp(new Date().toISOString());
  const end = event.end ?? new Date(+new Date(event.start) + 30 * 60000).toISOString();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Loutakis Real Estate//Inspections//EN",
    "CALSCALE:GREGORIAN",
    // PUBLISH, not REQUEST: this is an event to keep, not an invitation that
    // implies we are tracking a reply.
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${esc(event.uid)}`,
    `DTSTAMP:${now}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(event.title)}`,
    ...(event.location ? [`LOCATION:${esc(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${esc(event.description)}`] : []),
    ...(event.url ? [`URL:${esc(event.url)}`] : []),
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
  ];

  if (event.remindMinutes) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `TRIGGER:-PT${Math.round(event.remindMinutes)}M`,
      `DESCRIPTION:${esc(event.title)}`,
      "END:VALARM"
    );
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  // CRLF throughout — Outlook rejects bare newlines.
  return lines.map(fold).join("\r\n") + "\r\n";
}

/**
 * "Add to Google Calendar" as a plain link.
 *
 * Android and desktop users are better served by this than by a downloaded
 * file, which Chrome drops into the downloads tray and leaves there.
 */
export function googleCalendarUrl(event: CalendarEvent): string {
  const end = event.end ?? new Date(+new Date(event.start) + 30 * 60000).toISOString();
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${stamp(event.start)}/${stamp(end)}`,
    ...(event.description ? { details: event.description } : {}),
    ...(event.location ? { location: event.location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
