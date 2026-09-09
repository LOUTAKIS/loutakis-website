"use client";

import { useEffect, useState } from "react";
import { googleCalendarUrl } from "@/lib/ics";
import type { CalendarEvent } from "@/lib/ics";

/**
 * "Add to calendar" beside an inspection or auction time — one glyph, no words.
 *
 * It used to be two links, "Add to calendar" and "Google", because the two
 * platforms want different things: an .ics file opens straight into the
 * calendar on an iPhone, while Chrome on Android drops it into the downloads
 * tray where it is never seen again. Making the buyer choose was the wrong way
 * to solve that — it put our plumbing in front of them, twice per inspection.
 *
 * So the choice is made for them. The link renders as the .ics for everyone
 * (which is what the server can know, and what every desktop calendar and
 * every iPhone handles), and swaps to Google's template URL on Android once
 * the browser tells us it is Android. With no JavaScript it stays the .ics,
 * which still works — it is only ever an improvement, never a dependency.
 *
 * Google's template URL cannot carry an alarm, so that route falls back to the
 * viewer's own default reminder. The .ics carries a real one, which is the
 * whole point of offering this at all.
 */
export default function AddToCalendar({
  event,
  href,
  label = "Add to calendar",
}: {
  event: CalendarEvent;
  /** Our .ics route for this event. */
  href: string;
  /** Not shown — this is the accessible name, so it must still say which event. */
  label?: string;
}) {
  const [target, setTarget] = useState(href);

  useEffect(() => {
    if (/Android/i.test(navigator.userAgent)) setTarget(googleCalendarUrl(event));
    // The URL is derived from the event, and the event is a plain object
    // rebuilt on every render, so depend on the parts that actually matter.
  }, [event.uid, event.start, href]); // eslint-disable-line react-hooks/exhaustive-deps

  const external = target !== href;

  return (
    <a
      href={target}
      className="cal-add"
      aria-label={label}
      title={label}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {/* A calendar with a plus in it. Drawn rather than an icon font so it
          inherits the ink colour and stays crisp at any density. */}
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true" focusable="false">
        <rect x="3" y="5" width="18" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
        <path d="M12 13v5M9.5 15.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
      </svg>
    </a>
  );
}
