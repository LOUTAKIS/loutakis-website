"use client";

import { useState } from "react";

/**
 * "Refresh from Box & Dice" for the staff dashboard.
 *
 * The site re-reads the CRM every 10 minutes on its own, so this exists for the
 * one case that matters: you have just changed something in Box & Dice and want
 * to see it on the site now, usually with a vendor on the phone.
 *
 * It reports what actually happened rather than flashing a tick — a refresh that
 * silently did nothing is worse than no button, because you would go on believing
 * the site was current.
 */
export default function RefreshListings() {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function refresh() {
    if (state === "working") return;
    setState("working");
    setMessage("");
    try {
      const res = await fetch("/api/staff/refresh-listings", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Failed (${res.status})`);
      setState("done");
      setMessage("Refreshed — reload a page to see the change.");
    } catch (err: any) {
      setState("error");
      setMessage(err?.message || "Couldn't refresh just now.");
    }
  }

  return (
    <span className="refresh-wrap">
      <button type="button" className="btn" onClick={refresh} disabled={state === "working"}>
        {state === "working" ? "Refreshing…" : "Refresh from Box & Dice"}
      </button>
      {message && (
        <span className={`refresh-msg ${state === "error" ? "bad" : ""}`} role="status">
          {message}
        </span>
      )}
    </span>
  );
}
