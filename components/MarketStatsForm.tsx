"use client";

import { useState } from "react";
import type { ReaSnapshot, ReaTypeRow } from "@/lib/rea-stats";

type Ours = {
  totalSold: number;
  medianPrice: number | null;
  byType: { type: string; sold: number; medianPrice: number | null }[];
};

const TYPES = ["House", "Townhouse", "Apartment"];

const money = (n: number | null | undefined) =>
  n ? `$${Math.round(n).toLocaleString("en-AU")}` : "—";

/**
 * Enter what REA publishes, and see what our own CRM says beside it.
 *
 * The comparison column is the real work here. These figures go on a public
 * page as performance claims, and the moment ours and REA's drift apart it
 * usually means something in Box & Dice needs attention — a sale with no sale
 * date, or a property filed under the wrong category. Better to notice that
 * here than to have a vendor notice it on the website.
 */
export default function MarketStatsForm({
  current,
  ours,
}: {
  current: ReaSnapshot | null;
  ours: Ours | null;
}) {
  const [rows, setRows] = useState<ReaTypeRow[]>(
    TYPES.map((type) => {
      const existing = current?.rows.find((r) => r.type === type);
      return existing ?? { type, sold: 0, medianPrice: 0, medianDays: 0 };
    })
  );
  const [totalSold, setTotalSold] = useState(current?.totalSold ? String(current.totalSold) : "");
  const [medianPrice, setMedianPrice] = useState(current?.medianPrice ? String(current.medianPrice) : "");
  const [checkedOn, setCheckedOn] = useState(
    current?.checkedOn ?? new Date().toISOString().slice(0, 10)
  );
  const [published, setPublished] = useState(current?.published ?? false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  const setRow = (type: string, field: keyof ReaTypeRow, value: string) =>
    setRows((rs) => rs.map((r) => (r.type === type ? { ...r, [field]: value as never } : r)));

  const oursFor = (type: string) => ours?.byType.find((t) => t.type === type);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setMessage("");
    try {
      const res = await fetch("/api/staff/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, totalSold, medianPrice, checkedOn, published }),
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
              <th scope="col">Median days</th>
              <th scope="col" className="ms-ours">Our CRM says</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const o = oursFor(r.type);
              /**
               * Only compare once a figure has actually been typed. An empty
               * field is not a discrepancy — before this guard a blank form
               * accused itself of being 26 sales out on every row.
               */
              const entered = Number(r.sold) > 0;
              const soldGap = o && entered ? Number(r.sold) - o.sold : 0;
              return (
                <tr key={r.type}>
                  <th scope="row">{r.type}</th>
                  <td>
                    <input
                      className="field"
                      inputMode="numeric"
                      value={r.sold ? String(r.sold) : ""}
                      onChange={(e) => setRow(r.type, "sold", e.target.value)}
                      aria-label={`${r.type} sold`}
                    />
                  </td>
                  <td>
                    <input
                      className="field"
                      value={r.medianPrice ? String(r.medianPrice) : ""}
                      onChange={(e) => setRow(r.type, "medianPrice", e.target.value)}
                      placeholder="985k"
                      aria-label={`${r.type} median price`}
                    />
                  </td>
                  <td>
                    <input
                      className="field"
                      inputMode="decimal"
                      value={r.medianDays ? String(r.medianDays) : ""}
                      onChange={(e) => setRow(r.type, "medianDays", e.target.value)}
                      aria-label={`${r.type} median days`}
                    />
                  </td>
                  <td className="ms-ours">
                    {o ? (
                      <>
                        {o.sold} sold · {money(o.medianPrice)}
                        {soldGap !== 0 && (
                          <span className="ms-gap">
                            {soldGap > 0 ? `${soldGap} more on REA` : `${-soldGap} more in CRM`}
                          </span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ms-totals">
        <label className="ap-field">
          <span>Total sold</span>
          <input
            className="field"
            inputMode="numeric"
            value={totalSold}
            onChange={(e) => setTotalSold(e.target.value)}
          />
        </label>
        <label className="ap-field">
          <span>Overall median price</span>
          <input
            className="field"
            value={medianPrice}
            onChange={(e) => setMedianPrice(e.target.value)}
            placeholder="908k"
          />
        </label>
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

      {ours && (
        <p className="ms-note">
          Our CRM, same 12 months: <strong>{ours.totalSold} sold</strong>, median{" "}
          <strong>{money(ours.medianPrice)}</strong>. Days advertised is not in this
          list on purpose — the CRM records when the authority was signed, not when
          advertising began, so it cannot be compared.
        </p>
      )}

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
