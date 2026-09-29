"use client";

import { useState } from "react";

/**
 * Which campaign a prospective vendor sees at /marketingapproval.
 *
 * Deliberately a deliberate act. Nothing is nominated by default, and nothing
 * is nominated automatically: a page that quietly showed "the newest campaign"
 * would put whoever signed this morning in front of strangers without anyone
 * choosing it. Somebody in the office picks the property, and can take it down
 * in one click.
 *
 * Choosing one takes a COPY of it, there and then. The example stays exactly
 * as it was — for months, if that is how long it is before anyone changes it —
 * while the campaign behind it is approved, tidied away or deleted. So the
 * property you pick does not have to stay in the list above to keep being the
 * example, and an approval left open for that reason is one more thing on a
 * screen that should only show work outstanding.
 */
/** "on 4 March" — a date, because this one sits still for months. */
function when(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "earlier";
  return `on ${d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}`;
}

export default function DemoPicker({
  campaigns,
  current,
  configured,
}: {
  campaigns: { id: string; address: string }[];
  /** The frozen example, if there is one. Its campaign may no longer exist. */
  current: { id: string; address: string; at: string } | null;
  configured: boolean;
}) {
  const [id, setId] = useState(current?.id ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(next: string) {
    setId(next);
    setState("saving");
    try {
      const res = await fetch("/api/staff/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: next }),
      });
      if (!res.ok) throw new Error();
      setState("saved");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="demo-pick">
      <div className="eyebrow">Example for prospective vendors</div>
      <p className="form-note">
        One campaign, shown at <strong>loutakis.com.au/marketingapproval</strong> behind the shared
        password, so a seller can see the page before they list. Names, emails and who approved what
        are never shown there — only the marketing, which is already advertised.
      </p>
      <p className="form-note">
        Choosing one copies it as it stands today. It keeps showing that, unchanged, until you pick
        something else — the campaign itself can be approved, tidied away or deleted without
        touching the example.
      </p>
      <label>
        <span>Show</span>
        <select className="field" value={id} onChange={(e) => save(e.target.value)}>
          <option value="">Nothing — page is off</option>
          {/* The one in use, listed first — it may no longer be a live campaign. */}
          {current && !campaigns.some((c) => c.id === current.id) && (
            <option value={current.id}>{current.address} (kept)</option>
          )}
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.address}
            </option>
          ))}
        </select>
      </label>
      {!configured && (
        <p className="form-note" style={{ color: "#b00020" }}>
          No password is set, so the page shows nothing to anyone. Set MARKETING_DEMO_PASSWORD in
          Vercel first.
        </p>
      )}
      {state === "saving" && <p className="form-note">Saving…</p>}
      {state === "saved" && (
        <p className="form-note">Saved. Global Config takes about ten seconds to catch up.</p>
      )}
      {state === "idle" && current && (
        <p className="form-note">
          Showing <strong>{current.address}</strong>, copied {when(current.at)}.
        </p>
      )}
      {state === "error" && (
        <p className="form-note" style={{ color: "#b00020" }}>
          Couldn&rsquo;t save that — try again.
        </p>
      )}
    </div>
  );
}
