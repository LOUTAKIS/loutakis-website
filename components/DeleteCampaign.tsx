"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Removes an unapproved campaign after a confirm. Approved ones can't be deleted. */
export default function DeleteCampaign({ id, address }: { id: string; address: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function del(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete the approval for ${address}? The vendor's link (if sent) will stop working.`)) return;
    setBusy(true);
    const res = await fetch(`/api/staff/campaigns/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else {
      setBusy(false);
      alert("Couldn't delete that.");
    }
  }
  return (
    <button className="vc-del" onClick={del} disabled={busy} aria-label={`Delete ${address}`}>
      {busy ? "…" : "Delete"}
    </button>
  );
}
