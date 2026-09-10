"use client";

import { useState } from "react";

/**
 * A ranked table with a People / Views switch.
 *
 * The two are not the same question and the difference matters. "202" against
 * 19 William Street means the page was opened 202 times; it might be thirty
 * people who kept coming back, which is a stronger signal than two hundred
 * strangers glancing once. Before this, the top-pages table showed views and
 * the referrers table showed people, with nothing on screen saying which — the
 * numbers were unreadable because the unit was invisible.
 */
export type StatRow = { name: string; visitors: number; pageviews: number };

export default function StatTable({
  rows,
  label,
  /** Which unit to open on. Referrers are about people; pages about opens. */
  initial = "views",
  empty = "Nothing recorded yet.",
}: {
  rows: StatRow[];
  label: string;
  initial?: "people" | "views";
  empty?: string;
}) {
  const [unit, setUnit] = useState<"people" | "views">(initial);

  const sorted = [...rows].sort((a, b) =>
    unit === "people" ? b.visitors - a.visitors : b.pageviews - a.pageviews
  );

  return (
    <div>
      <div className="st-head">
        <div className="times-label">{label}</div>
        <div className="st-toggle" role="group" aria-label={`${label}: people or views`}>
          <button
            type="button"
            className={unit === "people" ? "on" : undefined}
            onClick={() => setUnit("people")}
            aria-pressed={unit === "people"}
          >
            People
          </button>
          <button
            type="button"
            className={unit === "views" ? "on" : undefined}
            onClick={() => setUnit("views")}
            aria-pressed={unit === "views"}
          >
            Views
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>{empty}</p>
      ) : (
        <table className="wa-table">
          <tbody>
            {sorted.map((r) => (
              <tr key={r.name}>
                <th scope="row">{r.name}</th>
                <td>
                  {(unit === "people" ? r.visitors : r.pageviews).toLocaleString("en-AU")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
