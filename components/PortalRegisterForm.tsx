"use client";

import { useState } from "react";

const SITUATIONS = [
  "Buying my first home",
  "Upsizing",
  "Downsizing",
  "Investing",
  "Currently renting",
  "Just looking",
];

const BUDGETS = [
  "Under $600,000",
  "$600,000 – $800,000",
  "$800,000 – $1m",
  "$1m – $1.5m",
  "$1.5m – $2m",
  "Over $2m",
];

const TIMEFRAMES = ["Ready now", "Within 3 months", "3–6 months", "6–12 months", "Just watching"];

export default function PortalRegisterForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;

    const f = new FormData(e.currentTarget);
    setState("sending");
    setError("");

    try {
      const res = await fetch("/api/portal/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: f.get("firstName"),
          lastName: f.get("lastName"),
          email: f.get("email"),
          mobile: f.get("mobile"),
          situation: f.get("situation"),
          budget: f.get("budget"),
          suburbs: f.get("suburbs"),
          beds: f.get("beds"),
          timeframe: f.get("timeframe"),
          confidentiality: f.get("confidentiality") === "on",
          marketing: f.get("marketing") === "on",
          company: f.get("company"), // honeypot
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok && json?.ok) {
        setState("sent");
      } else {
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
        <h3>Thanks — we&rsquo;ve got it.</h3>
        <p>
          Michael reviews every request personally, so this isn&rsquo;t automatic. We&rsquo;ll be in
          touch shortly to confirm your access.
        </p>
        <p className="form-note">
          If you need something sooner, call <a href="tel:0409438025">0409 438 025</a>.
        </p>
      </div>
    );
  }

  return (
    <form className="portal-form" onSubmit={onSubmit} noValidate>
      <div className="pf-row">
        <label>
          <span>First name</span>
          <input className="field" name="firstName" required autoComplete="given-name" />
        </label>
        <label>
          <span>Last name</span>
          <input className="field" name="lastName" required autoComplete="family-name" />
        </label>
      </div>

      <div className="pf-row">
        <label>
          <span>Mobile</span>
          <input
            className="field"
            name="mobile"
            type="tel"
            inputMode="tel"
            placeholder="04__ ___ ___"
            required
            autoComplete="tel"
          />
        </label>
        <label>
          <span>Email</span>
          <input className="field" name="email" type="email" required autoComplete="email" />
        </label>
      </div>

      <label>
        <span>Where are you at?</span>
        <select className="field" name="situation" required defaultValue="">
          <option value="" disabled>
            Choose one
          </option>
          {SITUATIONS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>

      <p className="pf-optional">The rest is optional — it just helps us call you about the right places.</p>

      <div className="pf-row">
        <label>
          <span>Budget</span>
          <select className="field" name="budget" defaultValue="">
            <option value="">No preference</option>
            {BUDGETS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Minimum bedrooms</span>
          <select className="field" name="beds" defaultValue="">
            <option value="">No preference</option>
            {["1", "2", "3", "4", "5+"].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="pf-row">
        <label>
          <span>Suburbs you&rsquo;re looking in</span>
          <input className="field" name="suburbs" placeholder="Yarraville, Seddon, Kingsville…" />
        </label>
        <label>
          <span>Timeframe</span>
          <select className="field" name="timeframe" defaultValue="">
            <option value="">No preference</option>
            {TIMEFRAMES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Honeypot — off-screen rather than display:none, which bots detect. */}
      <input
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      <div className="pf-checks">
        <label className="pf-check">
          <input type="checkbox" name="confidentiality" required />
          <span>
            These properties aren&rsquo;t publicly advertised, and some vendors are selling
            privately for personal reasons. <strong>I agree to keep what I see here
            confidential</strong> and not to share it.
          </span>
        </label>

        <label className="pf-check">
          <input type="checkbox" name="marketing" />
          <span>
            Send me market updates and new listings by email and SMS. (Optional — you&rsquo;ll hear
            about off-market properties either way.)
          </span>
        </label>
      </div>

      <button className="btn" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Request access"}
      </button>

      {state === "error" && (
        <p className="form-note" role="alert" style={{ color: "#b00020" }}>
          {error}
        </p>
      )}

      <p className="form-note">
        We collect these details to assess your request and to contact you about properties. They go
        into our client system and aren&rsquo;t shared with anyone else. See our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>
    </form>
  );
}
