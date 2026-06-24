"use client";

import { useMemo, useState } from "react";
import { Listing } from "@/lib/types";
import ListingCard from "./ListingCard";

const TABS: { key: string; label: string }[] = [
  { key: "current", label: "Current" },
  { key: "sold", label: "Sold" },
];

export default function PropertyFilters({ listings }: { listings: Listing[] }) {
  const [tab, setTab] = useState("current");
  const [suburb, setSuburb] = useState("all");

  const suburbs = useMemo(
    () => Array.from(new Set(listings.map((l) => l.address.suburb))).sort(),
    [listings]
  );

  const matchesTab = (l: Listing) =>
    tab === "current"
      ? l.status === "current" || l.status === "under_offer"
      : tab === "all" || l.status === tab;

  const filtered = listings.filter(
    (l) => matchesTab(l) && (suburb === "all" || l.address.suburb === suburb)
  );

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div className="tabs" style={{ margin: "30px 0 0" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <select
          value={suburb}
          onChange={(e) => setSuburb(e.target.value)}
          className="field"
          style={{ width: "auto", marginBottom: 0 }}
        >
          <option value="all">All suburbs</option>
          {suburbs.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="grid" style={{ marginTop: 40 }}>
        {filtered.map((l) => (
          <ListingCard key={l.id} listing={l} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p style={{ color: "var(--muted)", marginTop: 30 }}>
          No properties match this filter right now.
        </p>
      )}
    </>
  );
}
