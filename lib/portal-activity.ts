import "server-only";
import { readActivity, writeActivity } from "./portal-store";

/**
 * What a member does while signed in.
 *
 * SCOPE, STATED PLAINLY. This records only what someone does once they have
 * registered, been approved and signed in — their own account activity, the
 * same as any bank or airline records. It cannot and does not see anonymous
 * browsing: a visitor who has never signed in is unknown to us, and no amount
 * of building would change that. The privacy policy should say we keep a
 * record of member activity before this goes live.
 *
 * WHAT IT IS NOT: an analytics pipeline. Volumes here are a handful of members
 * doing a handful of things a week. The store is Vercel Global Config, whose
 * writes take about ten seconds to propagate, so two events landing in the
 * same instant can overwrite one another. That is accepted: losing one row of
 * "opened the list" costs nothing, and the alternative is a database this site
 * does not otherwise need.
 */

export type ActivityKind =
  /** Signed in — by code or by the link in the email. */
  | "signin"
  /** Opened the private list. */
  | "list"
  /** Opened a property page while signed in. */
  | "view"
  /** Pressed Enquire on a property. */
  | "enquiry";

export type Activity = {
  /** Epoch ms. Short key because this is stored as JSON, thousands of times. */
  t: number;
  k: ActivityKind;
  /** Listing id, for view and enquiry. */
  p?: string;
  /** Address as shown at the time, so the log still reads if the listing goes. */
  a?: string;
};

/**
 * How much we keep per person. Sixty events is months of real use for a buyer,
 * and it bounds the stored value so one busy member can't bloat the config.
 */
const KEEP = 60;

/**
 * Repeat views of the same property inside this window count once. Without it,
 * a member refreshing a listing page four times reads as four separate visits
 * and drowns everything else in their timeline.
 */
const DEDUPE_MS = 30 * 60 * 1000;

export async function recordActivity(
  contactId: number | string,
  event: Omit<Activity, "t">
): Promise<void> {
  try {
    const now = Date.now();
    const current = await readActivity(contactId);

    const last = current[0];
    if (
      last &&
      last.k === event.k &&
      last.p === event.p &&
      now - last.t < DEDUPE_MS
    ) {
      return;
    }

    // Newest first: the member page reads the top of the list, and trimming
    // the tail is then just a slice.
    await writeActivity(contactId, [{ t: now, ...event }, ...current].slice(0, KEEP));
  } catch (err) {
    // Never let a log write break the thing being logged.
    console.error("[activity] write failed", err);
  }
}

export type ActivitySummary = {
  events: Activity[];
  lastSeen: number | null;
  signIns30d: number;
  /** Distinct listings they have opened, newest first. */
  viewed: { id: string; address: string; count: number; last: number }[];
  enquiries: Activity[];
};

export async function getActivity(contactId: number | string): Promise<ActivitySummary> {
  const events = await readActivity(contactId);
  const cutoff = Date.now() - 30 * 86_400_000;

  const viewed = new Map<string, { id: string; address: string; count: number; last: number }>();
  for (const e of events) {
    if (e.k !== "view" || !e.p) continue;
    const seen = viewed.get(e.p);
    if (seen) {
      seen.count += 1;
      seen.last = Math.max(seen.last, e.t);
    } else {
      viewed.set(e.p, { id: e.p, address: e.a || e.p, count: 1, last: e.t });
    }
  }

  return {
    events,
    lastSeen: events[0]?.t ?? null,
    signIns30d: events.filter((e) => e.k === "signin" && e.t >= cutoff).length,
    viewed: [...viewed.values()].sort((a, b) => b.last - a.last),
    enquiries: events.filter((e) => e.k === "enquiry"),
  };
}
