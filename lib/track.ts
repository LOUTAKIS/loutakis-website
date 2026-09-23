/**
 * "Somebody started filling this in." The one thing only the browser knows.
 *
 * THIS USED TO SEND FOUR EVENTS TO VERCEL AND NONE OF THEM WERE EVER RECORDED.
 * Custom events are a Pro and Enterprise feature; on Hobby `track()` fires into
 * nothing, which is why the Website page spent a month reporting that it
 * couldn't load form events. They were never there to load.
 *
 * So the counting moved to where the facts are. `sent` and `failed` are now
 * recorded by the API routes that actually do the work — see lib/form-events.ts
 * — because the server is the only honest witness to whether an enquiry was
 * delivered. A browser reporting its own success is a claim, not evidence, and
 * the failure case that matters most is exactly the one where the browser
 * cannot report anything at all.
 *
 * That leaves one event worth sending from here: the start. A person who types
 * their name, reconsiders and closes the tab never reaches any route we own, so
 * without this there is no way to tell a form nobody wants from a form nobody
 * can finish.
 *
 * NOTHING PERSONAL IS EVER SENT. One word — which form. No names, no
 * addresses, no emails, no message text, and no identifier of any kind.
 */

export type FormName = "appraisal" | "enquiry" | "register" | "portal-enquiry" | "questionnaire";

/** Fire once per visit, not once per field — the callers guard on a ref. */
export function formStarted(form: FormName) {
  const body = JSON.stringify({ form, outcome: "started" });
  try {
    /**
     * sendBeacon survives the page being closed in the same moment, which is
     * precisely the case worth counting. Falls back to a keepalive fetch, and
     * gives up silently: a missed count is never worth an error in a visitor's
     * console, and analytics must never be able to break a form.
     */
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/form-event", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    fetch("/api/form-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* nothing to do */
  }
}
