"use client";

import { useEffect, useState } from "react";
import { useLightbox } from "./Lightbox";

/**
 * The brochure as the object it is — a four-panel closed gatefold — rather
 * than two flat PDF pages.
 *
 *   Closed          →  Open the middle     →  Open the gates
 *   [cover]            [gate L][gate R]       [in 1][in 2][in 3][in 4]
 *   (flip: back)       "LOUTAKIS / address"    floorplan … photos
 *                      "Vendors' Story"
 *
 * The PDF has two pages: the OUTSIDE of the sheet and the INSIDE. Each is
 * sliced into four equal panels. PANELS below says which slice plays which
 * part; print flats are mirrored relative to each other, so this was set by
 * looking at a real brochure and is the one thing to adjust if a panel is in
 * the wrong place.
 */

type Ref = { page: 0 | 1; panel: 0 | 1 | 2 | 3 };

const PANELS: {
  cover: Ref;
  back: Ref;
  gateLeft: Ref; // seen after opening the middle, left  ("LOUTAKIS / address")
  gateRight: Ref; // seen after opening the middle, right ("Vendors' Story")
  inner: [Ref, Ref, Ref, Ref]; // fully open, left to right
} = {
  cover: { page: 0, panel: 2 },
  back: { page: 0, panel: 1 },
  gateLeft: { page: 0, panel: 3 },
  gateRight: { page: 0, panel: 0 },
  inner: [
    { page: 1, panel: 0 },
    { page: 1, panel: 1 },
    { page: 1, panel: 2 },
    { page: 1, panel: 3 },
  ],
};

type Slices = [string[], string[]]; // [outside panels, inside panels]

export default function BrochureFold({ src, name }: { src: string; name: string }) {
  const [slices, setSlices] = useState<Slices | null>(null);
  const [ratio, setRatio] = useState(210 / 99); // panel height / width; DL until measured
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [showBack, setShowBack] = useState(false);

  const pick = (r: Ref) => slices?.[r.page]?.[r.panel] ?? "";
  const lbImages = slices
    ? [
        { src: pick(PANELS.cover), alt: "Front cover" },
        { src: pick(PANELS.back), alt: "Back cover" },
        { src: pick(PANELS.gateLeft), alt: "Inside left" },
        { src: pick(PANELS.gateRight), alt: "Inside right" },
        ...PANELS.inner.map((r, i) => ({ src: pick(r), alt: `Inside spread, panel ${i + 1}` })),
      ]
    : [];
  const { open, node } = useLightbox(lbImages);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ url: src }).promise;
        if (doc.numPages < 2) throw new Error(`expected 2 pages, got ${doc.numPages}`);

        const out: Slices = [[], []];
        for (let n = 1; n <= 2; n++) {
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(2.5, 2400 / base.width);
          const vp = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;

          const pw = Math.floor(vp.width / 4);
          if (n === 1) setRatio(vp.height / pw);
          for (let k = 0; k < 4; k++) {
            const c = document.createElement("canvas");
            c.width = pw;
            c.height = vp.height;
            c.getContext("2d")!.drawImage(canvas, k * pw, 0, pw, vp.height, 0, 0, pw, vp.height);
            out[n - 1].push(c.toDataURL("image/jpeg", 0.9));
          }
        }
        if (!cancelled) {
          setSlices(out);
          setState("ready");
        }
      } catch (err) {
        console.error("[brochure fold] failed", err);
        if (!cancelled) setState("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (state === "failed") {
    return (
      <a className="btn" href={src} target="_blank" rel="noopener">
        Open the brochure ↗
      </a>
    );
  }
  if (!slices) return <div className="vb-loading">Preparing the brochure…</div>;

  // Which lightbox index a face maps to (see lbImages order).
  const LB = { cover: 0, back: 1, gateLeft: 2, gateRight: 3, inner: (i: number) => 4 + i };

  const stepLabel = stage === 0 ? "Open it" : stage === 1 ? "Open fully" : "Fold it up";
  const advance = () => {
    if (stage === 2) {
      // Fold the way paper folds: gates in first, then the cover — never both at once.
      setStage(1);
      setTimeout(() => setStage(0), 950);
    } else setStage((stage + 1) as 1 | 2);
  };

  const Face = ({ side, r, lb, label }: { side: "front" | "rear"; r: Ref; lb: number; label: string }) => (
    <button className={`bf-face ${side}`} onClick={() => open(lb)} aria-label={label}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={pick(r)} alt="" draggable={false} />
    </button>
  );

  return (
    <div className="bf" style={{ ["--r" as any]: ratio }}>
      <div className={`bf-stage s${stage}${showBack ? " back" : ""}`}>
        {/* The sheet, built as it is folded: each panel hinged to the one it folds onto.
            base (P2)  ── gateR (P3) hinged on its right edge
                       └─ cover (P1) hinged on its left edge
                             └─ gateL (P0) hinged on the cover's left edge */}
        <div className="bf-card bf-base">
          <Face side="front" r={PANELS.inner[2]} lb={LB.inner(2)} label="Inside spread, third panel" />
          <Face side="rear" r={PANELS.back} lb={LB.back} label="Back cover" />

          <div className="bf-card bf-gateR">
            <Face side="front" r={PANELS.inner[3]} lb={LB.inner(3)} label="Inside spread, last panel" />
            <Face side="rear" r={PANELS.gateRight} lb={LB.gateRight} label="Inside right" />
          </div>

          <div className="bf-card bf-cover">
            <Face side="front" r={PANELS.inner[1]} lb={LB.inner(1)} label="Inside spread, second panel" />
            <Face side="rear" r={PANELS.cover} lb={LB.cover} label="Front cover" />

            <div className="bf-card bf-gateL">
              <Face side="front" r={PANELS.inner[0]} lb={LB.inner(0)} label="Inside spread, first panel" />
              <Face side="rear" r={PANELS.gateLeft} lb={LB.gateLeft} label="Inside left" />
            </div>
          </div>
        </div>
      </div>

      <div className="bf-controls">
        <button className="btn" onClick={advance}>{stepLabel}</button>
        {stage === 0 && (
          <button className="btn ghost" onClick={() => setShowBack((v) => !v)}>
            {showBack ? "Show the front" : "Turn it over"}
          </button>
        )}
        <span className="bf-hint">
          {stage === 0 && "Tap any panel to see it up close."}
          {stage === 1 && "The inside covers. Open fully for the spread."}
          {stage === 2 && "The full inside spread, as it prints."}
        </span>
      </div>
      <p className="vp-note">
        Four panels, printed both sides. <a href={src} target="_blank" rel="noopener">Open the PDF</a> ({name}).
      </p>
      {node}
    </div>
  );
}
