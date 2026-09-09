"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Approve, decline or revoke one member.
 *
 * Revoking asks first. Approving and declining are both recoverable — you can
 * do the other one a moment later — but taking access away from someone who
 * has had it for months is the kind of thing you do by mis-clicking, and they
 * find out by being locked out.
 */
export default function MemberActions({
  contactId,
  status,
  name,
}: {
  contactId: number;
  status: "approved" | "pending" | "none";
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function act(action: "approve" | "decline" | "revoke") {
    if (busy) return;
    if (action === "revoke" && !confirm(`Remove ${name}'s access to the off-market list?`)) return;

    setBusy(action);
    setError("");
    try {
      const res = await fetch("/api/staff/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "That didn't work.");
      // Re-read from the CRM rather than patching the row here: the category
      // is the truth, and this page should show what it now says.
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "That didn't work.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mb-actions">
      {status === "pending" && (
        <>
          <button type="button" className="btn" onClick={() => act("approve")} disabled={Boolean(busy)}>
            {busy === "approve" ? "Approving…" : "Approve"}
          </button>
          <button type="button" className="btn ghost" onClick={() => act("decline")} disabled={Boolean(busy)}>
            {busy === "decline" ? "Declining…" : "Decline"}
          </button>
        </>
      )}
      {status === "approved" && (
        <button type="button" className="btn ghost" onClick={() => act("revoke")} disabled={Boolean(busy)}>
          {busy === "revoke" ? "Removing…" : "Remove access"}
        </button>
      )}
      {status === "none" && (
        <button type="button" className="btn" onClick={() => act("approve")} disabled={Boolean(busy)}>
          {busy === "approve" ? "Approving…" : "Give access"}
        </button>
      )}
      {error && <span className="mb-error" role="alert">{error}</span>}
    </div>
  );
}
