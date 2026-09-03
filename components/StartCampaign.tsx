"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Creates a draft campaign for a listing and opens the review screen. */
export default function StartCampaign({ listingId, disabled }: { listingId: number; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function start() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/staff/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.id) throw new Error(json?.error || `HTTP ${res.status}`);
      router.push(`/staff/${json.id}`);
    } catch (e: any) {
      setErr(e?.message || "Couldn't start that. Try again.");
      setBusy(false);
    }
  }

  return (
    <div style={{ textAlign: "right" }}>
      <button className="btn" onClick={start} disabled={busy || disabled}>
        {busy ? "Gathering…" : "Start"}
      </button>
      {err && <div className="form-note" style={{ color: "#b00020", marginTop: 8 }}>{err}</div>}
    </div>
  );
}
