"use client";

import { useState } from "react";

export default function VendorApprovalForm({
  campaignId,
  token,
  wording,
  preview,
}: {
  campaignId: string;
  token: string;
  wording: string;
  preview: boolean;
}) {
  const [state, setState] = useState<"idle" | "sending" | "approved" | "changes" | "error">("idle");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  async function submit(action: "approve" | "changes") {
    if (preview) {
      alert("Preview only — nothing is sent from here.");
      return;
    }
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (action === "changes" && !notes.trim()) {
      setError("Tell us what you'd like changed.");
      return;
    }
    setState("sending");
    setError("");
    try {
      const res = await fetch(`/api/vendor/${campaignId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, action, name, notes }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Something went wrong.");
      setState(action === "approve" ? "approved" : "changes");
    } catch (e: any) {
      setState("error");
      setError(e?.message || "Something went wrong. Please call 0409 438 025.");
    }
  }

  if (state === "approved") {
    return (
      <div className="portal-done" role="status">
        <h3>Thank you — approved.</h3>
        <p>We&rsquo;ve emailed you a copy for your records, and production is under way.</p>
      </div>
    );
  }
  if (state === "changes") {
    return (
      <div className="portal-done" role="status">
        <h3>Got it.</h3>
        <p>Michael has your notes and will be in touch. You&rsquo;ll see the updated version at this same link.</p>
      </div>
    );
  }

  return (
    <form className="portal-form" onSubmit={(e) => { e.preventDefault(); submit("approve"); }} noValidate>
      <label>
        <span>Your full name</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
      </label>
      <label>
        <span>If there are any amendments, please make note here</span>
        <textarea className="field" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <p className="va-wording">{wording}</p>

      <div className="va-buttons">
        <button type="submit" className="btn" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Approve marketing"}
        </button>
        <button type="button" className="btn ghost" disabled={state === "sending"} onClick={() => submit("changes")}>
          Request changes
        </button>
      </div>

      {error && (
        <p className="form-note" role="alert" style={{ color: "#b00020" }}>{error}</p>
      )}
    </form>
  );
}
