"use client";

import { useState } from "react";

export default function PortalSignInForm({ expired = false }: { expired?: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;
    const identifier = String(new FormData(e.currentTarget).get("identifier") ?? "");

    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/portal/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.ok) setState("sent");
      else {
        setState("error");
        setError(json?.error || "Something went wrong. Please call 0409 438 025.");
      }
    } catch {
      setState("error");
      setError("Couldn't reach us just now — check your connection, or call 0409 438 025.");
    }
  }

  if (state === "sent") {
    return (
      <div className="portal-done" role="status">
        <h3>Check your email</h3>
        <p>
          If those details are registered with us, a sign-in link is on its way. It works for fifteen
          minutes.
        </p>
        <p className="form-note">
          Nothing arrived? Check spam, or make sure you used the email or mobile you registered with.
        </p>
      </div>
    );
  }

  return (
    <form className="portal-form" onSubmit={onSubmit} noValidate>
      {expired && (
        <p className="form-note" role="alert" style={{ marginBottom: 14 }}>
          That link has expired or already been used. Request a fresh one below.
        </p>
      )}
      <label>
        <span>Email or mobile you registered with</span>
        <input className="field" name="identifier" required autoComplete="email" autoFocus />
      </label>
      <button className="btn" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {state === "error" && (
        <p className="form-note" role="alert" style={{ color: "#b00020" }}>
          {error}
        </p>
      )}
      <p className="form-note">
        Not registered yet? <a href="/portal/register">Request access</a>.
      </p>
    </form>
  );
}
