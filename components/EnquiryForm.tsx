"use client";

import { useState } from "react";

export default function EnquiryForm({ listingId }: { listingId?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          message: form.get("message"),
          listingId,
        }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <p style={{ color: "var(--accent)" }}>
        Thank you — your enquiry has been sent and recorded in our system. We&apos;ll be in touch shortly.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <input className="field" name="name" placeholder="Your name" required />
      <input className="field" name="email" type="email" placeholder="Email" required />
      <input className="field" name="phone" placeholder="Phone" />
      <textarea className="field" name="message" placeholder="I'd like to know more about this property…" required />
      <button className="btn" style={{ width: "100%" }} disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Enquire →"}
      </button>
      {state === "error" && (
        <p className="form-note" style={{ color: "#b23" }}>Something went wrong. Please email us directly.</p>
      )}
      <p className="form-note">We&rsquo;ll be in touch shortly.</p>
    </form>
  );
}
