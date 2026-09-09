"use client";

import { useState } from "react";
import type { ReaDays } from "@/lib/rea-stats";

type Ours = {
  totalSold: number;
  medianPrice: number | null;
  byType: { type: string; sold: number; medianPrice: number | null }[];
};

const money = (n: number | null | undefined) =>
  n ? `$${Math.round(n).toLocaleString("en-AU")}` : "—";

/**
 * Three numbers, once a quarter.
 *
 * Sold counts and median prices are computed from the CRM and shown here
 * read-only — they need no input and they already agree with REA. The only
 * thing typed is median days advertised, which the CRM cannot produce because
 * it records when the authority was signed, not when advertising began.
 *
 * The read-only column doubles as a check: if it ever stops matching what REA
 * shows, something in Box & Dice needs attention rather than something here.
 */
export default function MarketStatsForm({
  current,
  ours,
}: {
  current: ReaDays | null;
  ours: Ours | null;
}) {
  const types = ours?.byType.map((t) => t.type) ?? ["House", "Townhouse", "Apartment"];

  const [days, setDays] = useState<Record<string, string>>(() =>
    Object.fromEntries(types.map((t) => [t, current?.days?.[t] ? String(current.days[t]) : ""]))
  );
  const [checkedOn, setCheckedOn] = useState(
    current?.checkedOn ?? new Date().toISOString().slice(0, 10)
  );
  const [published, setPublished] = useState(current?.published ?? false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setMessage("");
    try {
      const res = await fetch("/api/staff/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, checkedOn, published }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Failed (${res.status})`);
      setState("saved");
      setMessage(published ? "Saved and live on Sell with us." : "Saved. Not published yet.");
    } catch (err: any) {
      setState("error");
      setMessage(err?.message || "Could not save.");
    }
  }

  return (
    <form onSubmit={save} className="ms-form">
      <div className="ms-scroll">
        <table className="ms-table">
          <thead>
            <tr>
              <th scope="col">Property</th>
              <th scope="col">Sold</th>
              <th scope="col">Median price</th>
              <th scope="col">Median days advertised</th>
            </tr>
          </thead>
          <tbody>
            {(ours?.byType ?? []).map((t) => (
              <tr key={t.type}>
                <th scope="row">{t.type}</th>
                <td className="ms-auto">{t.sold}</td>
                <td className="ms-auto">{money(t.medianPrice)}</td>
                <td>
                  <input
                    className="field"
                    inputMode="decimal"
                    value={days[t.type] ?? ""}
                    onChange={(e) => setDays((d) => ({ ...d, [t.type]: e.target.value }))}
                    placeholder="20.5"
                    aria-label={`${t.type} median days advertised`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="ms-note">
        Sold and median price come straight from Box&nbsp;&amp;&nbsp;Dice — nothing to type,
        and they update themselves. Only <strong>days advertised</strong> is entered,
        because the CRM records when the authority was signed rather than when
        advertising began.
        {ours && (
          <>
            {" "}
            Across all types: <strong>{ours.totalSold} sold</strong>, median{" "}
            <strong>{money(ours.medianPrice)}</strong>.
          </>
        )}
      </p>

      <div className="ms-totals">
        <label className="ap-field">
          <span>Read off REA on</span>
          <input
            className="field"
            type="date"
            value={checkedOn}
            onChange={(e) => setCheckedOn(e.target.value)}
          />
        </label>
      </div>

      <label className="ms-publish">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
        />
        <span>Show these figures on the Sell with us page</span>
      </label>

      <div className="ms-actions">
        <button type="submit" className="btn" disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : "Save"}
        </button>
        {message && (
          <span className={`ms-msg ${state === "error" ? "bad" : ""}`} role="status">
            {message}
          </span>
        )}
      </div>
    </form>
  );
}
