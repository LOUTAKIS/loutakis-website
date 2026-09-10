"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Sign in by email. Once the email is sent the page turns into a code box, so
 * someone reading the email on their phone can finish here on the computer in
 * front of them — the link in the same email is for people already on the
 * device they want to browse on.
 */
export default function PortalSignInForm({ expired = false }: { expired?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);

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

  async function submitCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (checking) return;
    setChecking(true);
    setError("");
    try {
      const res = await fetch("/api/portal/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.ok) {
        router.push("/portal");
        return;
      }
      setError(json?.error || "That code doesn't match.");
    } catch {
      setError("Couldn't reach us just now — check your connection.");
    }
    setChecking(false);
  }

  if (state === "sent") {
    return (
      <div className="portal-code" role="status">
        <h3>Check your email</h3>
        <p>
          If those details are registered with us, we&rsquo;ve sent a six-digit code. Enter it here,
          or tap the button in the email if you&rsquo;re on the device you want to browse on.
        </p>
        <form className="portal-form" onSubmit={submitCode} noValidate>
          <label>
            <span>Six-digit code</span>
            <input
              className="field code-field"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              required
            />
          </label>
          <button className="btn" disabled={checking || code.length !== 6}>
            {checking ? "Checking…" : "Sign in"}
          </button>
          {error && (
            <p className="form-note" role="alert" style={{ color: "#b00020" }}>
              {error}
            </p>
          )}
        </form>
        <p className="form-note">
          Nothing arrived? Check spam, or{" "}
          <button type="button" className="linkish" onClick={() => { setState("idle"); setCode(""); setError(""); }}>
            try another email or mobile
          </button>
          . The code works for fifteen minutes.
        </p>
      </div>
    );
  }

  return (
    <>
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
        {state === "sending" ? "Sending…" : "Email me a sign-in code"}
      </button>
      {state === "error" && (
        <p className="form-note" role="alert" style={{ color: "#b00020" }}>
          {error}
        </p>
      )}
    </form>

    {/**
      * Registering is the other half of this page, not a footnote to it.
      *
      * It was one grey sentence in 13px under the button, and someone who has
      * never heard of the list — which is most people who reach this screen —
      * read past it and left. Half of the visitors here cannot sign in, because
      * they have no account yet: this is their door, and it now looks like one.
      */}
    <div className="portal-alt">
      <div className="portal-alt-label">Not registered?</div>
      <a href="/portal/register" className="portal-alt-cta">
        Request access
      </a>
    </div>
    </>
  );
}
