"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Listing } from "@/lib/types";
import ListingCard from "./ListingCard";
import { countPhrase } from "@/lib/off-market-copy";

const TABS: { key: string; label: string }[] = [
  { key: "current", label: "Current" },
  { key: "sold", label: "Sold" },
];

export default function PropertyFilters({
  listings,
  /**
   * How many properties are on the private list. Counted on the server and
   * passed in as a bare number — no listing ever reaches this page, which is
   * the whole promise the private list rests on.
   */
  offMarketCount = 0,
}: {
  listings: Listing[];
  offMarketCount?: number;
}) {
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
      {/* Three tracks so the tabs sit dead centre of the page rather than
          centred in whatever space the suburb menu leaves them. */}
      <div className="filter-bar">
        <span aria-hidden />
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
          {/* Not a filter — the private list lives behind a sign-in, so this
              one leaves the page rather than switching what's shown. */}
          <Link href="/portal/off-market" className="tab tab-link">
            Off-market
            {/* The count as a badge, so the tab itself carries the reason to
                click it. Absent at zero rather than showing a "0" that reads
                as an empty list. */}
            {offMarketCount > 0 && (
              <span className="tab-badge" aria-label={`${offMarketCount} available`}>
                {offMarketCount}
              </span>
            )}
          </Link>
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

      {/* Current listings only. Someone browsing past sales is reading history,
          not shopping — pitching the private list there reads as a sales pitch
          on a results page. */}
      {tab === "current" && (
        <aside className="offmarket-card">
          <div>
            <div className="eyebrow">Off-market</div>
            <h3>Not everything we sell is here.</h3>
            <p>
              Some owners prefer a quiet campaign.{" "}
              {/* Only when there is something on it. At zero this falls back to
                  the general sentence rather than admitting to an empty list on
                  the page that is meant to open it. */}
              {offMarketCount > 0 ? (
                <strong>{countPhrase(offMarketCount)}.</strong>
              ) : (
                "Those homes go to a private list."
              )}
            </p>
          </div>
          <Link href="/portal/register" className="btn">Request access</Link>
        </aside>
      )}
    </>
  );
}
