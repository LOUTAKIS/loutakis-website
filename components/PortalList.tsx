"use client";

import { useMemo, useState } from "react";
import PortalEnquire from "./PortalEnquire";

/**
 * The private list: search, filter, sort, sectioned by property type.
 *
 * WHAT THE BROWSER RECEIVES IS THE WHOLE POINT. This component is handed rows,
 * not listings — street name, suburb, type, four numbers and an id. No
 * photograph, no description, no agent details, and no street number, because
 * anything passed to a client component is in the page source whether it is
 * rendered or not. A vendor on a quiet campaign is entitled to that, and "we
 * didn't show it" is not the same as "we didn't send it".
 *
 * TWO LINES PER PROPERTY, NOT A TABLE. It was a seven-column table, and at
 * full width the eye had to cross three empty gaps to get from the address to
 * the button; Type repeated the heading directly above it, and Land was a
 * column of dashes because almost nothing carries one. An address and a line
 * of specs need no columns to line up, and read the same on a phone.
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
  /** As shown, e.g. "696m²" — empty when the CRM has none, and then omitted. */
  land: string;
  /** Sortable land size. Null sorts last in both directions. */
  landValue: number | null;
};

type SortKey = "latest" | "address" | "beds" | "land";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "latest", label: "Latest first" },
  { key: "address", label: "Street A–Z" },
  { key: "beds", label: "Most bedrooms" },
  { key: "land", label: "Largest land" },
];

/**
 * REA's order, and the order a buyer thinks in. Anything the CRM calls
 * something else sorts after these, and "Other" always sits last.
 */
const TYPE_ORDER = ["House", "Townhouse", "Apartment", "Unit", "Villa", "Land"];

function typeRank(t: string): number {
  if (t === "Other") return 999;
  const i = TYPE_ORDER.indexOf(t);
  return i < 0 ? 99 : i;
}

/** "House" → "Houses". Left alone where an -s would be wrong. */
function plural(type: string, n: number): string {
  if (n === 1 || type === "Other" || type === "Land" || type.endsWith("s")) return type;
  return `${type}s`;
}

export default function PortalList({ rows }: { rows: PortalRow[] }) {
  const [q, setQ] = useState("");
  const [suburb, setSuburb] = useState("all");
  const [minBeds, setMinBeds] = useState(0);
  const [sort, setSort] = useState<SortKey>("latest");

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

    // "latest" is the order the CRM gave us — most recently updated first.
    if (sort === "latest") return filtered;

    // Sorted on a copy: mutating the memo input would reorder the source list
    // under React and make the next render's "latest" a lie.
    return [...filtered].sort((a, b) => {
      if (sort === "address") {
        return a.street.localeCompare(b.street) || a.suburb.localeCompare(b.suburb);
      }
      if (sort === "beds") return b.bed - a.bed;
      // A property with no land figure has nothing to compare, so it sits at
      // the bottom rather than reading as the smallest block here.
      if (a.landValue === null) return 1;
      if (b.landValue === null) return -1;
      return b.landValue - a.landValue;
    });
  }, [rows, q, suburb, minBeds, sort]);

  /**
   * Sectioned by property type, because a buyer looking for a house is not
   * looking for an apartment and shouldn't have to read past them. Filtering
   * and sorting happen first and then divide into sections, so a sort orders
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

  const filtering = Boolean(q.trim()) || suburb !== "all" || minBeds > 0;
  function clear() {
    setQ("");
    setSuburb("all");
    setMinBeds(0);
  }

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
        {/* Sorting moved here from the column headings, which no longer exist. */}
        <select
          className="field"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort the list"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        {filtering && (
          <button type="button" className="pl-clear" onClick={clear}>
            Clear
          </button>
        )}
      </div>

      <div className="pl">
        {sections.map((s) => (
          <section key={s.type} className="pl-section">
            <h3 className="pl-sectionhead">
              {plural(s.type, s.rows.length)}
              <span className="pl-count">{s.rows.length}</span>
            </h3>

            {s.rows.map((r) => (
              <div key={r.id} className="pl-row" id={r.slug}>
                <div>
                  <div className="pl-addr">
                    {r.street}, {r.suburb}
                  </div>
                  {/* One line of specs. Land appears only when the CRM has a
                      figure — a dash in every row taught nobody anything — and
                      it is never stated as fact, hence "approx.". */}
                  <div className="pl-specs">
                    {r.bed} bed <span aria-hidden>·</span> {r.bath} bath <span aria-hidden>·</span>{" "}
                    {r.car} car
                    {r.land && (
                      <>
                        {" "}
                        <span aria-hidden>·</span> {r.land} approx.
                      </>
                    )}
                  </div>
                </div>
                <PortalEnquire listingId={r.id} />
              </div>
            ))}
          </section>
        ))}

        {shown.length === 0 && (
          <p className="pl-none">
            Nothing on the private list matches that.{" "}
            <button type="button" className="pl-clear" onClick={clear}>
              Clear the filters
            </button>
          </p>
        )}
      </div>
    </>
  );
}
