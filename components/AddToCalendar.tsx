import { googleCalendarUrl } from "@/lib/ics";
import type { CalendarEvent } from "@/lib/ics";

/**
 * "Add to calendar" beside an inspection or auction time.
 *
 * Two links, because one is not enough on its own:
 *
 *   the .ics file  — what iPhones want. Safari opens it straight into the
 *                    calendar with the alarm intact, which is the whole point.
 *   Google         — what Android and desktop want. Chrome files a downloaded
 *                    .ics into the downloads tray and it is never seen again.
 *
 * Plain links, no JavaScript: this has to work on a phone with one bar of
 * signal standing outside a house, which is exactly when it is used.
 *
 * Google's template URL cannot carry an alarm, so that route relies on the
 * viewer's own default reminder. The .ics carries a real one.
 */
export default function AddToCalendar({
  event,
  href,
  label = "Add to calendar",
}: {
  event: CalendarEvent;
  /** Our .ics route for this event. */
  href: string;
  label?: string;
}) {
  return (
    <span className="cal-add">
      <a href={href} className="cal-link">
        {label}
      </a>
      <a
        href={googleCalendarUrl(event)}
        className="cal-link cal-google"
        target="_blank"
        rel="noopener noreferrer"
      >
        Google
      </a>
    </span>
  );
}
