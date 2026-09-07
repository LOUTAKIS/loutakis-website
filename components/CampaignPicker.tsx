"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import StartCampaign from "./StartCampaign";

export type PickerItem = {
  id: number;
  address: string;
  suburb: string;
  photos: number;
  floorplans: number;
  hasCopy: boolean;
  hasVideo: boolean;
  /** The live campaign for this listing, if one is already in flight. */
  campaign: { id: string; status: string } | null;
};

type Sort = "ready" | "address" | "suburb";

/**
 * The property picker: type to filter, choose an order. Ready listings first by
 * default, because that's what a staff member can actually act on — the rest
 * are waiting on the CRM.
 */
export default function CampaignPicker({ items }: { items: PickerItem[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("ready");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? items.filter((i) => `${i.address} ${i.suburb}`.toLowerCase().includes(needle))
      : items;

    const missing = (i: PickerItem) =>
      [
        i.photos === 0 ? "photos" : "",
        !i.hasCopy ? "advertising copy" : "",
        i.floorplans === 0 ? "a floorplan" : "",
      ].filter(Boolean);

    const withState = filtered.map((i) => ({ ...i, missing: missing(i) }));
    const byAddress = (a: PickerItem, b: PickerItem) => a.address.localeCompare(b.address, "en-AU");

    return [...withState].sort((a, b) => {
      if (sort === "address") return byAddress(a, b);
      if (sort === "suburb") return a.suburb.localeCompare(b.suburb, "en-AU") || byAddress(a, b);
      // "ready": in flight first, then ready to start, then blocked.
      const rank = (x: typeof a) => (x.campaign ? 0 : x.missing.length === 0 ? 1 : 2);
      return rank(a) - rank(b) || byAddress(a, b);
    });
  }, [items, q, sort]);

  const list = (m: string[]) =>
    m.length > 1 ? `${m.slice(0, -1).join(", ")} and ${m[m.length - 1]}` : m[0];

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
        <label className="vc-sort">
          <span>Order by</span>
          <select className="field" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="ready">Ready to start</option>
            <option value="address">Address (A–Z)</option>
            <option value="suburb">Suburb (A–Z)</option>
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="form-note" style={{ marginTop: 24 }}>
          Nothing matches “{q}”.
        </p>
      ) : (
        <ul className="vc-pick">
          {rows.map((s) => {
            const ready = s.missing.length === 0;
            const live = s.campaign && s.campaign.status !== "approved" ? s.campaign : null;
            return (
              <li key={s.id}>
                <div>
                  <div className="vc-addr">{s.address}</div>
                  <div className="vc-meta">
                    {s.photos} photo{s.photos === 1 ? "" : "s"}
                    {s.floorplans ? ` · ${s.floorplans} floorplan${s.floorplans === 1 ? "" : "s"}` : ""}
                    {s.hasCopy ? " · copy" : ""}
                    {s.hasVideo ? " · video" : ""}
                  </div>
                  {!ready && (
                    <div className="vc-meta vc-warn">
                      Add {list(s.missing)} in Box &amp; Dice, then reload this page.
                    </div>
                  )}
                  {live && (
                    <div className="vc-meta">
                      Already in flight ({live.status === "draft" ? "not sent" : live.status}).
                    </div>
                  )}
                </div>
                {live ? (
                  <Link href={`/staff/${live.id}`} className="btn">
                    Open
                  </Link>
                ) : (
                  <StartCampaign listingId={s.id} disabled={!ready} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
