"use client";

import { useState } from "react";

/**
 * Enquiry form — posts to /api/enquiry, which emails via Microsoft 365.
 * It does NOT write to Box & Dice. (Read-only site: no CRM records created.)
 *
 * The visitor is only told the message was sent once the server confirms it.
 */
export default function EnquiryForm({
  listingId,
  listingAddress,
}: {
  listingId?: string;
  listingAddress?: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;

    const form = e.currentTarget;
    const f = new FormData(form);

    setState("sending");
    setError("");

    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.get("name"),
          email: f.get("email"),
          phone: f.get("phone"),
          message: f.get("message"),
          company: f.get("company"), // honeypot
          listingId,
          listingAddress,
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json?.ok) {
        setState("sent");
        form.reset();
      } else {
        setState("error");
        setError(
          json?.error ||
            "Sorry — we couldn't send that just now. Please call 0409 438 025."
        );
      }
    } catch {
      setState("error");
      setError(
        "Sorry — we couldn't send that just now. Please check your connection, or call 0409 438 025."
      );
    }
  }

  if (state === "sent") {
    return (
      <p className="form-note" role="status">
        Thanks — your enquiry has been sent. We&rsquo;ll be in touch shortly.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <input className="field" name="name" placeholder="Your name" required />
      <input className="field" name="email" type="email" placeholder="Email" required />
      <input className="field" name="phone" placeholder="Phone" />
      <textarea className="field" name="message" placeholder="I'd like to know more…" required />

      {/* Honeypot — hidden from people, catnip to bots. Not display:none, which
          some bots detect; off-screen and removed from the tab order instead. */}
      <input
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      <button className="btn" style={{ width: "100%" }} disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : <>Enquire &rarr;</>}
      </button>

      {state === "error" && (
        <p className="form-note" role="alert" style={{ color: "#b00020" }}>
          {error}
        </p>
      )}

      <p className="form-note">
        We&rsquo;ll use your details only to respond to this enquiry. See our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>
    </form>
  );
}
