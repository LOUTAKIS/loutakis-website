"use client";

import { useState } from "react";

export default function StaffSignInForm({ expired = false }: { expired?: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    setState("sending");
    try {
      await fetch("/api/staff/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      setState("sent");
    }
  }

  if (state === "sent") {
    return (
      <div className="portal-done" role="status">
        <h3>Check your email</h3>
        <p>If that address is on the staff list, a sign-in link is on its way. It works for fifteen minutes.</p>
      </div>
    );
  }

  return (
    <form className="portal-form" onSubmit={onSubmit} noValidate>
      {expired && (
        <p className="form-note" role="alert" style={{ marginBottom: 14 }}>
          That link has expired or already been used. Request a fresh one.
        </p>
      )}
      <label>
        <span>Your Loutakis email</span>
        <input className="field" name="email" type="email" required autoComplete="email" autoFocus />
      </label>
      <button className="btn" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
