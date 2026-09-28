"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Creates a draft campaign for a listing and opens the review screen.
 *
 * `label` and `quiet` exist for the one case where this is NOT the obvious
 * thing to do: a property whose marketing has already been approved. Starting
 * another campaign there is legitimate — a relaunch with new photographs after
 * a price change — but it must read as a deliberate second act rather than as
 * the primary button, which is how 20 West Street came to look untouched three
 * days after its vendor signed it off.
 */
export default function StartCampaign({
  listingId,
  disabled,
  label = "Start",
  quiet,
  confirm,
}: {
  listingId: number;
  disabled?: boolean;
  label?: string;
  quiet?: boolean;
  confirm?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function start() {
    // A second campaign on an approved property is worth one question.
    if (confirm && !window.confirm(confirm)) return;
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
      <button
        className={quiet ? "btn ghost" : "btn"}
        onClick={start}
        disabled={busy || disabled}
      >
        {busy ? "Gathering…" : label}
      </button>
      {err && <div className="form-note" style={{ color: "#b00020", marginTop: 8 }}>{err}</div>}
    </div>
  );
}
