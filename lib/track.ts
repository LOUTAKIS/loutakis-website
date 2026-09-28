/**
 * The two things only the browser knows: that somebody started, and that
 * somebody gave up.
 *
 * THIS USED TO SEND FOUR EVENTS TO VERCEL AND NONE OF THEM WERE EVER RECORDED.
 * Custom events are a Pro and Enterprise feature; on Hobby `track()` fires into
 * nothing, which is why the Website page spent a month reporting that it
 * couldn't load form events. They were never there to load.
 *
 * So the counting moved to where the facts are. `sent` and `failed` are
 * recorded by the API routes that do the work — see lib/form-events.ts —
 * because the server is the only honest witness to whether an enquiry was
 * delivered. A browser reporting its own success is a claim, not evidence.
 *
 * What is left here is what a server cannot see: a person who types their name,
 * reconsiders, and closes the tab. They never reach any route we own, so
 * without this there is no way to tell a form nobody wants from a form nobody
 * can finish — or to know WHICH question is where they stop.
 *
 * NOTHING PERSONAL IS EVER SENT. Which form, the id of a field, and a number of
 * seconds. Never the contents of any field, and no identifier of any kind.
 */

export type FormName = "appraisal" | "enquiry" | "register" | "portal-enquiry" | "questionnaire";

function beacon(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
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

/**
 * Watch one form from the first keystroke to the end, however it ends.
 *
 * Returns a stop function for the component to call when it unmounts, and a
 * `finished` one to call on a successful send. Everything else — noticing the
 * first input, remembering which field, catching the page closing — happens in
 * here, so a form only has to say which form it is.
 */
export function watchForm(el: HTMLElement | null, form: FormName) {
  if (!el || typeof window === "undefined") return { finished: () => {}, stop: () => {} };

  let startedAt = 0;
  let lastField = "";
  let done = false;

  const nameOf = (t: EventTarget | null): string => {
    const n = t as HTMLInputElement | null;
    if (!n || !("tagName" in n)) return "";
    // The field's own name, never its value.
    return String(n.name || n.id || "").slice(0, 60);
  };

  const onInput = (e: Event) => {
    lastField = nameOf(e.target) || lastField;
    if (startedAt) return;
    startedAt = Date.now();
    beacon({ form, outcome: "started" });
  };

  const onFocus = (e: Event) => {
    const f = nameOf(e.target);
    if (f) lastField = f;
  };

  /**
   * pagehide rather than beforeunload: beforeunload is unreliable on mobile
   * Safari, which is where most of these visitors are, and it can block a
   * bfcache entry. Fires once — a person who leaves and comes back is not two
   * people giving up.
   */
  const onLeave = () => {
    if (done || !startedAt || !lastField) return;
    done = true;
    beacon({ form, outcome: "abandoned", field: lastField });
  };

  el.addEventListener("input", onInput, true);
  el.addEventListener("focusin", onFocus, true);
  window.addEventListener("pagehide", onLeave);

  return {
    /** Called on a successful send: stops the abandon watch and times it. */
    finished() {
      if (done) return;
      done = true;
      if (startedAt) {
        beacon({ form, outcome: "finished", seconds: Math.round((Date.now() - startedAt) / 1000) });
      }
    },
    stop() {
      el.removeEventListener("input", onInput, true);
      el.removeEventListener("focusin", onFocus, true);
      window.removeEventListener("pagehide", onLeave);
    },
  };
}
