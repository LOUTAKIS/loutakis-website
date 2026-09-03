"use client";

import { useState } from "react";
import type { Campaign, Selection } from "@/lib/campaigns";
import type { MarketingSource } from "@/lib/boxdice";

type File = { id: string; name: string; size: number; modified: string };

/**
 * The review screen. Everything gathered from Box & Dice and SharePoint,
 * ticked by default; the staff member unticks, tidies, adds the vendor, and
 * sends. Saves happen on Save; Send saves first.
 */
export default function CampaignReview({
  campaign,
  source,
  boardFiles,
  brochureFiles,
  staffEmail,
}: {
  campaign: Campaign;
  source: MarketingSource | null;
  boardFiles: File[];
  brochureFiles: File[];
  staffEmail: string;
}) {
  const [c, setC] = useState<Campaign>(campaign);
  const [sel, setSel] = useState<Selection>(campaign.selection);
  const [vendorName, setVendorName] = useState(campaign.vendorName);
  const [vendorEmail, setVendorEmail] = useState(campaign.vendorEmail);
  const [copyHeading, setCopyHeading] = useState(campaign.copyHeading);
  const [copyText, setCopyText] = useState(campaign.copyText);
  const [busy, setBusy] = useState<"" | "save" | "send">("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const photos = source?.photos ?? [];
  const floorplans = source?.floorplans ?? [];
  const excluded = new Set(sel.excludedPhotos);
  const shownPhotos = photos.filter((p) => !excluded.has(p.url)).length;

  const togglePhoto = (url: string) =>
    setSel((s) => ({
      ...s,
      excludedPhotos: excluded.has(url) ? s.excludedPhotos.filter((u) => u !== url) : [...s.excludedPhotos, url],
    }));

  async function save(): Promise<boolean> {
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch(`/api/staff/campaigns/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selection: sel, vendorName, vendorEmail, copyHeading, copyText }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setC(json.campaign);
      setMsg({ kind: "ok", text: "Saved." });
      return true;
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message || "Couldn't save." });
      return false;
    } finally {
      setBusy("");
    }
  }

  async function send() {
    if (!(await save())) return;
    if (!confirm(`Email the approval link to ${vendorName} <${vendorEmail}>?`)) return;
    setBusy("send");
    try {
      const res = await fetch(`/api/staff/campaigns/${c.id}`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setC(json.campaign);
      setMsg({ kind: "ok", text: `Sent to ${vendorEmail}.` });
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message || "Couldn't send." });
    } finally {
      setBusy("");
    }
  }

  const blurb = (k: keyof Selection["blurbs"], label: string) => (
    <label className="vc-blurb">
      <span>{label} — intro line (optional)</span>
      <textarea
        className="field"
        rows={2}
        value={sel.blurbs[k]}
        onChange={(e) => setSel((s) => ({ ...s, blurbs: { ...s.blurbs, [k]: e.target.value } }))}
      />
    </label>
  );

  return (
    <div className="vc-review">
      <div className="section-head" style={{ marginTop: 18 }}>
        <div>
          <div className="eyebrow">{c.status === "draft" ? "Not sent yet" : `Status: ${c.status}`}</div>
          <h2>{c.address}</h2>
          <p className="portal-intro" style={{ marginTop: 8 }}>
            Untick anything the vendor shouldn&rsquo;t see. Everything ticked appears on their page.
          </p>
        </div>
        <div className="vc-actions">
          <a className="link-btn" href={`/approve/${c.id}?preview=1`} target="_blank" rel="noopener">
            Preview as vendor ↗
          </a>
          <button className="btn ghost" onClick={save} disabled={!!busy}>
            {busy === "save" ? "Saving…" : "Save"}
          </button>
          <button className="btn" onClick={send} disabled={!!busy}>
            {busy === "send" ? "Sending…" : c.sentAt ? "Re-send link" : "Send to vendor"}
          </button>
        </div>
      </div>
      {msg && (
        <p className="form-note" role="status" style={{ color: msg.kind === "err" ? "#b00020" : "var(--muted)" }}>
          {msg.text}
        </p>
      )}

      {/* Vendor */}
      <div className="vc-block">
        <h3>Vendor</h3>
        <div className="pf-row">
          <label>
            <span>Name</span>
            <input className="field" value={vendorName} onChange={(e) => setVendorName(e.target.value)} autoComplete="off" />
          </label>
          <label>
            <span>Email</span>
            <input className="field" type="email" value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} autoComplete="off" />
          </label>
        </div>
        {c.sentAt && (
          <p className="form-note">
            Sent {new Date(c.sentAt).toLocaleString("en-AU", { timeZone: "Australia/Melbourne" })} by {c.sentBy}
            {c.openedAt ? ` · opened ${c.openCount} time${c.openCount === 1 ? "" : "s"}` : " · not opened yet"}
          </p>
        )}
        {c.amendments.length > 0 && (
          <div className="vc-amend">
            <div className="eyebrow">Changes requested</div>
            {c.amendments.map((a, i) => (
              <blockquote key={i} className="vc-quote">
                <strong>{a.name}</strong> · {new Date(a.at).toLocaleString("en-AU", { timeZone: "Australia/Melbourne" })}
                <br />
                {a.text}
              </blockquote>
            ))}
          </div>
        )}
      </div>

      {/* Board & brochure from SharePoint */}
      <div className="vc-block">
        <h3>Board and brochure <span className="vc-src">SharePoint</span></h3>
        {c.folderPath ? (
          <p className="form-note">Folder: <code>{c.folderPath}</code></p>
        ) : (
          <p className="form-note vc-warn">
            No SharePoint folder matched “{c.street} {c.number}”. Create <code>Properties/Current/{c.street} {c.number}/MEDIA/BOARD</code> and re-open this page.
          </p>
        )}
        <div className="pf-row">
          <FilePick
            label="Board"
            files={boardFiles}
            value={sel.boardId}
            onChange={(f) => setSel((s) => ({ ...s, boardId: f?.id ?? null, boardName: f?.name ?? null }))}
          />
          <FilePick
            label="Brochure"
            files={brochureFiles}
            value={sel.brochureId}
            onChange={(f) => setSel((s) => ({ ...s, brochureId: f?.id ?? null, brochureName: f?.name ?? null }))}
          />
        </div>
        <div className="pf-row">
          {blurb("board", "Board")}
          {blurb("brochure", "Brochure")}
        </div>
      </div>

      {/* Copy from Box & Dice */}
      <div className="vc-block">
        <h3>
          <label className="vc-tick">
            <input type="checkbox" checked={sel.includeCopy} onChange={(e) => setSel((s) => ({ ...s, includeCopy: e.target.checked }))} />
            Copy <span className="vc-src">Box &amp; Dice</span>
          </label>
        </h3>
        <label>
          <span className="pf-label">Heading</span>
          <input className="field" value={copyHeading} onChange={(e) => setCopyHeading(e.target.value)} />
        </label>
        <label>
          <span className="pf-label">Text — this exact wording is what they approve</span>
          <textarea className="field" rows={12} value={copyText} onChange={(e) => setCopyText(e.target.value)} />
        </label>
        {blurb("copy", "Copy")}
      </div>

      {/* Photos from Box & Dice */}
      <div className="vc-block">
        <h3>
          Photos <span className="vc-src">Box &amp; Dice · {shownPhotos} of {photos.length} shown</span>
        </h3>
        {photos.length === 0 && <p className="form-note vc-warn">No photos on the listing yet.</p>}
        <div className="vc-photos">
          {photos.map((p) => {
            const off = excluded.has(p.url);
            return (
              <button
                key={p.url}
                type="button"
                className={off ? "vc-photo off" : "vc-photo"}
                onClick={() => togglePhoto(p.url)}
                aria-pressed={!off}
                title={off ? "Hidden — click to show" : "Shown — click to hide"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" loading="lazy" />
                <span>{p.index === "MAIN" ? "Main" : p.index}</span>
              </button>
            );
          })}
        </div>
        {blurb("images", "Photos")}
      </div>

      {/* Floorplan */}
      <div className="vc-block">
        <h3>
          <label className="vc-tick">
            <input
              type="checkbox"
              checked={sel.includeFloorplan}
              disabled={floorplans.length === 0}
              onChange={(e) => setSel((s) => ({ ...s, includeFloorplan: e.target.checked }))}
            />
            Floorplan <span className="vc-src">Box &amp; Dice · {floorplans.length || "none tagged"}</span>
          </label>
        </h3>
        {floorplans.length > 0 && (
          <div className="vc-photos small">
            {floorplans.map((f) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={f.url} src={f.url} alt="" className="vc-plan" />
            ))}
          </div>
        )}
        {blurb("floorplan", "Floorplan")}
      </div>

      {/* Video */}
      <div className="vc-block">
        <h3>
          <label className="vc-tick">
            <input
              type="checkbox"
              checked={sel.includeVideo}
              disabled={!source?.videoUrl}
              onChange={(e) => setSel((s) => ({ ...s, includeVideo: e.target.checked }))}
            />
            Video <span className="vc-src">Box &amp; Dice{source?.videoUrl ? "" : " · none on the listing"}</span>
          </label>
        </h3>
        {source?.videoUrl && <p className="form-note"><code>{source.videoUrl}</code></p>}
        {blurb("video", "Video")}
      </div>

      <div className="vc-actions" style={{ justifyContent: "flex-end", marginTop: 8 }}>
        <button className="btn ghost" onClick={save} disabled={!!busy}>{busy === "save" ? "Saving…" : "Save"}</button>
        <button className="btn" onClick={send} disabled={!!busy}>{busy === "send" ? "Sending…" : c.sentAt ? "Re-send link" : "Send to vendor"}</button>
      </div>
      <p className="form-note">Signed in as {staffEmail}. The vendor’s page shows only what’s ticked here.</p>
    </div>
  );
}

function FilePick({
  label,
  files,
  value,
  onChange,
}: {
  label: string;
  files: File[];
  value: string | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <label>
      <span className="pf-label">{label}</span>
      <select
        className="field"
        value={value ?? ""}
        onChange={(e) => onChange(files.find((f) => f.id === e.target.value) ?? null)}
      >
        <option value="">Don’t show</option>
        {files.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name} · {Math.round(f.size / 1024)} KB
          </option>
        ))}
      </select>
      {files.length === 0 && <span className="form-note vc-warn">Nothing in the {label.toUpperCase()} folder yet.</span>}
    </label>
  );
}
