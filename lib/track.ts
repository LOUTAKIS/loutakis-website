import { track } from "@vercel/analytics";

/**
 * The funnel, in four events.
 *
 * Page views arrive on their own; they are not the question. The question is
 * how many people begin a form and how many finish it — for the appraisal form
 * especially, which asks nine questions of a seller who has not met us yet.
 * Without `abandoned` there is no way to tell a form nobody wants from a form
 * nobody can finish.
 *
 * NOTHING PERSONAL IS EVER SENT. Only which form, and what happened. Names,
 * addresses, emails and phone numbers stay between the browser, our own API and
 * Box & Dice — putting a seller's address into an analytics product would be a
 * privacy breach in exchange for a number we do not need.
 */

export type FormName = "appraisal" | "enquiry" | "portal-register" | "portal-signin";

type Detail = { form: FormName; [k: string]: string | number | boolean | null };

function send(event: string, detail: Detail) {
  try {
    track(event, detail);
  } catch {
    // Analytics must never be able to break a form. If the beacon fails, the
    // seller still gets through — that is the whole point of the form.
  }
}

/** The first keystroke in a form. Fire once per visit, not once per field. */
export function formStarted(form: FormName) {
  send("form_started", { form });
}

/** The submit button was pressed and validation passed. */
export function formSubmitted(form: FormName) {
  send("form_submitted", { form });
}

/**
 * The submission landed. `crm` says whether Box & Dice accepted the write, so
 * a run of successes with crm:false is visible here as well as in the inbox.
 */
export function formSucceeded(form: FormName, crm?: boolean) {
  send("form_succeeded", { form, ...(crm === undefined ? {} : { crm }) });
}

/**
 * Something went wrong. `reason` is our own short label — never the user's
 * input, and never a raw server message, which can carry detail we should not
 * be shipping to a third party.
 */
export function formFailed(form: FormName, reason: string) {
  send("form_failed", { form, reason: reason.slice(0, 60) });
}
