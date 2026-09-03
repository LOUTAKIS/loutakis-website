"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The last chapter. Name, notes, the authorisation wording, and two clear
 * choices. Approving reveals what happens next — the approval is a step
 * forward, not a full stop.
 */
export default function VendorApprovalForm({
  campaignId,
  token,
  wording,
  preview,
  address,
}: {
  campaignId: string;
  token: string;
  wording: string;
  preview: boolean;
  address: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "approved" | "changes" | "error">("idle");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // "Suggest a change" from the copy chapter lands here as a quote.
  useEffect(() => {
    const onSuggest = (e: Event) => {
      const quote = String((e as CustomEvent).detail ?? "").trim();
      if (!quote) return;
      setNotes((n) => `${n ? n.trimEnd() + "\n\n" : ""}“${quote}” — `);
      setTimeout(() => {
        const el = notesRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }, 400);
    };
    window.addEventListener("vendor:suggest", onSuggest);
    return () => window.removeEventListener("vendor:suggest", onSuggest);
  }, []);

  async function submit(action: "approve" | "changes") {
    if (preview) {
      alert("Preview only — nothing is sent from here.");
      return;
    }
    if (!name.trim()) return setError("Please enter your full name.");
    if (action === "changes" && !notes.trim()) return setError("Tell us what you'd like changed.");
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
      setTimeout(() => document.getElementById("approve")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e: any) {
      setState("error");
      setError(e?.message || "Something went wrong. Please call 0409 438 025.");
    }
  }

  if (state === "approved") {
    return (
      <div className="vdone" role="status">
        <div className="vdone-mark">✓</div>
        <h3>Approved. Thank you, {name.split(" ")[0]}.</h3>
        <p>A copy of this approval is on its way to your inbox. Here&rsquo;s what happens now:</p>
        <ol className="vnext">
          <li><strong>Today</strong><span>Michael is notified and production begins.</span></li>
          <li><strong>This week</strong><span>The board is ordered and the brochures go to print.</span></li>
          <li><strong>Launch</strong><span>{address} goes live on realestate.com.au and Domain, and the campaign begins.</span></li>
        </ol>
        <p className="vp-note">Anything at all — Michael is on 0409 438 025.</p>
      </div>
    );
  }
  if (state === "changes") {
    return (
      <div className="vdone" role="status">
        <h3>Got it, {name.split(" ")[0]}.</h3>
        <p>Michael has your notes and will be in touch shortly. Once the changes are made you&rsquo;ll see the updated version at this same link.</p>
      </div>
    );
  }

  return (
    <form className="vform" onSubmit={(e) => { e.preventDefault(); submit("approve"); }} noValidate>
      <label>
        <span>Your full name</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
      </label>
      <label>
        <span>Anything you&rsquo;d like changed? (optional)</span>
        <textarea ref={notesRef} className="field" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Leave blank if it's all good." />
      </label>

      <p className="vform-wording">{wording}</p>

      <div className="vform-buttons">
        <button type="submit" className="btn vbtn-primary" disabled={state === "sending"}>
          {state === "sending" ? "One moment…" : "Approve the marketing"}
        </button>
        <button type="button" className="btn ghost" disabled={state === "sending"} onClick={() => submit("changes")}>
          Request changes first
        </button>
      </div>
      {error && <p className="form-note" role="alert" style={{ color: "#b00020" }}>{error}</p>}
    </form>
  );
}
