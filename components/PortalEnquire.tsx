"use client";

import { useState } from "react";
import { formSubmitted, formSucceeded, formFailed } from "@/lib/track";

/**
 * "Enquire" on a row of the private list — one click, no form.
 *
 * This used to open the same enquiry form the public site uses: name, email,
 * phone, message. But everyone who can see this page has already registered,
 * been approved by Michael personally, and signed in. Asking them to type
 * their details again asks for what we already hold, and every field is
 * another place to change their mind.
 *
 * So the button sends. The server takes the buyer from their session, the
 * property from the id, and the agent from the listing — the browser supplies
 * nothing but which house.
 *
 * Afterwards the row says so and stays saying so, because the useful thing to
 * tell someone who has just enquired is that it worked and what happens next.
 */
export default function PortalEnquire({ listingId }: { listingId: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function send() {
    if (state === "sending" || state === "sent") return;
    setState("sending");
    setError("");
    formSubmitted("enquiry");

    try {
      const res = await fetch("/api/portal/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "That didn't send.");
      setState("sent");
      formSucceeded("enquiry");
    } catch (err: any) {
      // Told the truth, not a tick. A buyer who thinks we have their enquiry
      // and waits is worse off than one who knows to ring.
      setState("error");
      setError(err?.message || "That didn't send. Please call 0409 438 025.");
      formFailed("enquiry", "portal-send");
    }
  }

  if (state === "sent") {
    return (
      <span className="pl-sent" role="status">
        Enquired — we&rsquo;ll be in touch
      </span>
    );
  }

  return (
    <>
      <button type="button" className="pl-cta" onClick={send} disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Enquire"}
      </button>
      {state === "error" && (
        <span className="pl-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
