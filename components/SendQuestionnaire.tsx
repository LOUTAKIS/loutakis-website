"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Vendor } from "@/lib/vendors";

export type QItem = {
  id: number;
  address: string;
  suburb: string;
  /** A questionnaire already out on this property, if there is one. */
  sent: { id: string; status: string } | null;
};

/**
 * Pick a property, name the vendors, send.
 *
 * The vendors are typed rather than chosen, because Box & Dice's Website API
 * does not carry who owns a listing — the same gap the marketing approval works
 * around. Two fields and an Add button beats a lookup that cannot be built.
 */
export default function SendQuestionnaire({ items }: { items: QItem[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<QItem | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([{ name: "", email: "" }]);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? items.filter((i) => `${i.address} ${i.suburb}`.toLowerCase().includes(needle))
      : items;
    return [...list].sort((a, b) => a.address.localeCompare(b.address, "en-AU"));
  }, [items, q]);

  function setVendor(i: number, patch: Partial<Vendor>) {
    setVendors((v) => v.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  }

  async function send() {
    if (!picked) return;
    const clean = vendors.filter((v) => v.email.trim());
    if (!clean.length) return setError("Add at least one vendor with an email address.");
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/staff/questionnaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: picked.id, vendors: clean }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Something went wrong.");
      setState("done");
      router.push(`/staff/questionnaires/${json.id}`);
    } catch (e: any) {
      setState("error");
      setError(e?.message || "Something went wrong.");
    }
  }

  if (picked) {
    return (
      <div className="qn-send">
        <button type="button" className="backlink qn-back" onClick={() => setPicked(null)}>
          ← Choose a different property
        </button>
        <h3 className="qn-addr">{picked.address}</h3>
        {picked.sent && (
          <p className="form-note">
            One has already gone out on this property. Sending again re-uses the same link and
            keeps whatever they have already filled in.
          </p>
        )}

        <div className="portal-form">
          {vendors.map((v, i) => (
            <div className="pf-row vc-vendor" key={i}>
              <label>
                <span>Name</span>
                <input
                  className="field"
                  value={v.name}
                  onChange={(e) => setVendor(i, { name: e.target.value })}
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  className="field"
                  type="email"
                  value={v.email}
                  onChange={(e) => setVendor(i, { email: e.target.value })}
                />
              </label>
              {vendors.length > 1 && (
                <button
                  type="button"
                  className="vc-vendor-x"
                  onClick={() => setVendors((x) => x.filter((_, n) => n !== i))}
                  aria-label="Remove this vendor"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <p className="form-note">
            <button
              type="button"
              className="btn ghost"
              onClick={() => setVendors((v) => [...v, { name: "", email: "" }])}
            >
              Add another vendor
            </button>
          </p>
        </div>

        {error && <p className="qf-error" role="alert">{error}</p>}

        <div className="qf-actions">
          <button type="button" className="btn" onClick={send} disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Send the questions"}
          </button>
        </div>
        <p className="form-note">
          They get one link, good for 90 days. Their answers come back to the listing agent as a
          PDF and go on their contact card in Box &amp; Dice.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="vc-tools">
        <input
          className="field"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by street or suburb"
          aria-label="Search listings"
        />
      </div>
      <ul className="vc-list">
        {rows.map((i) => (
          <li key={i.id} className="vc-row">
            <button type="button" className="qn-pick" onClick={() => setPicked(i)}>
              <div className="vc-addr">{i.address}</div>
              <div className="vc-meta">{i.suburb}</div>
              {i.sent && (
                <span className={`vc-status ${i.sent.status === "complete" ? "approved" : "sent"}`}>
                  {i.sent.status === "complete" ? "Already answered" : "Already sent"}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="form-note">Nothing matches that.</p>}
    </>
  );
}
