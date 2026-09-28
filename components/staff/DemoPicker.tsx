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
 */
export default function DemoPicker({
  campaigns,
  current,
  configured,
}: {
  campaigns: { id: string; address: string }[];
  current: string | null;
  configured: boolean;
}) {
  const [id, setId] = useState(current ?? "");
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
      <label>
        <span>Show</span>
        <select className="field" value={id} onChange={(e) => save(e.target.value)}>
          <option value="">Nothing — page is off</option>
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
      {state === "error" && (
        <p className="form-note" style={{ color: "#b00020" }}>
          Couldn&rsquo;t save that — try again.
        </p>
      )}
    </div>
  );
}
