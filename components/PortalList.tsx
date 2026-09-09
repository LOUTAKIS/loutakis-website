"use client";

import { useMemo, useState } from "react";
import PortalEnquire from "./PortalEnquire";

/**
 * The private list: search, filter, sort.
 *
 * WHAT THE BROWSER RECEIVES IS THE WHOLE POINT. This component is handed rows,
 * not listings — street name, suburb, four numbers and an id. No photograph,
 * no description, no agent details, and no street number, because anything
 * passed to a client component is in the page source whether it is rendered or
 * not. A vendor on a quiet campaign is entitled to that, and "we didn't show
 * it" is not the same as "we didn't send it".
 *
 * Everything here runs on those rows in memory. There is no search endpoint
 * and no round trip: the list is a handful of properties, and a buyer typing
 * "Yarraville" should see it filter as they type.
 */
export type PortalRow = {
  id: string;
  slug: string;
  /** Street NAME only — never the number. */
  street: string;
  suburb: string;
  /** "House", "Townhouse", "Apartment" — the section this row sits under. */
  type: string;
  bed: number;
  bath: number;
  car: number;
  /** As shown, e.g. "696m² approx." — empty when the CRM has none. */
  land: string;
  /** Sortable land size. Null sorts last in both directions. */
  landValue: number | null;
};

type Key = "street" | "suburb" | "bed" | "bath" | "car" | "land";

const COLUMNS: { key: Key; label: string; numeric?: boolean }[] = [
  { key: "street", label: "Street" },
  { key: "suburb", label: "Suburb" },
  { key: "bed", label: "Bed", numeric: true },
  { key: "bath", label: "Bath", numeric: true },
  { key: "car", label: "Car", numeric: true },
  { key: "land", label: "Land approx.", numeric: true },
];

/**
 * REA's order, and the order a buyer thinks in. Anything the CRM calls
 * something else sorts after these three rather than disappearing.
 */
const TYPE_ORDER = ["House", "Townhouse", "Apartment", "Unit", "Villa", "Land"];

function typeRank(t: string): number {
  const i = TYPE_ORDER.indexOf(t);
  return i < 0 ? 99 : i;
}

export default function PortalList({ rows }: { rows: PortalRow[] }) {
  const [q, setQ] = useState("");
  const [suburb, setSuburb] = useState("all");
  const [minBeds, setMinBeds] = useState(0);
  /** Null means the order the CRM gave us: most recently updated first. */
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 } | null>(null);

  const suburbs = useMemo(
    () => [...new Set(rows.map((r) => r.suburb))].sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = rows.filter(
      (r) =>
        (suburb === "all" || r.suburb === suburb) &&
        r.bed >= minBeds &&
        (!needle ||
          r.street.toLowerCase().includes(needle) ||
          r.suburb.toLowerCase().includes(needle))
    );

    if (!sort) return filtered;

    // Sorted on a copy: mutating the memo input would reorder the source list
    // under React and make the next render's "no sort" state a lie.
    return [...filtered].sort((a, b) => {
      if (sort.key === "street" || sort.key === "suburb") {
        return a[sort.key].localeCompare(b[sort.key]) * sort.dir;
      }
      if (sort.key === "land") {
        // A property with no land figure has nothing to compare, so it sits at
        // the bottom whichever way the column is pointing.
        if (a.landValue === null) return 1;
        if (b.landValue === null) return -1;
        return (a.landValue - b.landValue) * sort.dir;
      }
      return (a[sort.key] - b[sort.key]) * sort.dir;
    });
  }, [rows, q, suburb, minBeds, sort]);

  /**
   * Sectioned by property type, because a buyer looking for a house is not
   * looking for an apartment and shouldn't have to read past them. Sorting and
   * searching happen first and then divide into sections, so a sort orders
   * within each type rather than tearing the sections apart.
   */
  const sections = useMemo(() => {
    const byType = new Map<string, PortalRow[]>();
    for (const r of shown) {
      const t = r.type || "Other";
      byType.set(t, [...(byType.get(t) ?? []), r]);
    }
    return [...byType.entries()]
      .map(([type, rows]) => ({ type, rows }))
      .sort((a, b) => typeRank(a.type) - typeRank(b.type) || a.type.localeCompare(b.type));
  }, [shown]);

  function toggle(key: Key) {
    setSort((s) =>
      // Third click clears it, back to the order the CRM gave us — otherwise
      // there is no way to get the newest-first view back without a reload.
      s?.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null
    );
  }

  const filtering = Boolean(q.trim()) || suburb !== "all" || minBeds > 0;

  return (
    <>
      <div className="pl-controls">
        <input
          type="search"
          className="field"
          placeholder="Search street or suburb"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search the private list"
        />
        <select
          className="field"
          value={suburb}
          onChange={(e) => setSuburb(e.target.value)}
          aria-label="Filter by suburb"
        >
          <option value="all">All suburbs</option>
          {suburbs.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="field"
          value={minBeds}
          onChange={(e) => setMinBeds(Number(e.target.value))}
          aria-label="Filter by bedrooms"
        >
          <option value={0}>Any beds</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n}+ beds</option>
          ))}
        </select>
        {filtering && (
          <button
            type="button"
            className="pl-clear"
            onClick={() => { setQ(""); setSuburb("all"); setMinBeds(0); }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="pl">
        <div className="pl-head">
          {COLUMNS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`pl-sort${c.numeric ? " pl-n" : ""}${sort?.key === c.key ? " on" : ""}`}
              onClick={() => toggle(c.key)}
              aria-label={`Sort by ${c.label}`}
            >
              {c.label}
              {/* An arrow only on the column actually sorting, so the header
                  row does not read as six arrows and one meaning. */}
              {sort?.key === c.key && <span aria-hidden>{sort.dir === 1 ? " ↑" : " ↓"}</span>}
            </button>
          ))}
          {/* Type is not sortable: the sections already order by it, and a
              sort control that only reproduces the existing order is a lie
              about what it does. */}
          <span className="pl-typehead">Type</span>
          <span />
        </div>

        {sections.map((s) => (
          <div key={s.type} className="pl-section">
            <div className="pl-sectionhead">
              {s.type}
              <span className="pl-count">
                {s.rows.length} {s.rows.length === 1 ? "property" : "properties"}
              </span>
            </div>

            {s.rows.map((r) => (
              <div key={r.id} className="pl-row" id={r.slug}>
                <span className="pl-street">{r.street}</span>
                <span className="pl-suburb">{r.suburb}</span>
                <span className="pl-n"><b className="pl-lbl">Bed </b>{r.bed}</span>
                <span className="pl-n"><b className="pl-lbl">Bath </b>{r.bath}</span>
                <span className="pl-n"><b className="pl-lbl">Car </b>{r.car}</span>
                {/* Never state a land size as fact: the measurement is
                    indicative, and the column heading says approx. */}
                <span className="pl-land">{r.land || "—"}</span>
                <span className="pl-type">{r.type || "—"}</span>
                <PortalEnquire listingId={r.id} />
              </div>
            ))}
          </div>
        ))}

        {shown.length === 0 && (
          <p className="pl-none">
            Nothing on the private list matches that. <button type="button" className="pl-clear" onClick={() => { setQ(""); setSuburb("all"); setMinBeds(0); }}>Clear the filters</button>
          </p>
        )}
      </div>
    </>
  );
}
