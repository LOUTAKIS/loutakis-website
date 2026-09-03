"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  // The chapter head (left column) offers a slot for the controls, so they sit with the words, not under the object.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(document.getElementById("bf-controls-slot")), []);

  /**
   * The shadow, baked into a bitmap at the panel's real pixel size (re-baked
   * on resize). A live CSS blur on a panel inside the 3D scene is rasterised
   * at low quality and bands; a bitmap is sampled smoothly. Each panel wears
   * it as a background on ::after (see .bf-card::after), so it turns and lifts
   * with the paper. 0 18px 44px rgba(0,0,0,.14): pad 80 each side, 62 top, 98 bottom.
   */
  const rootRef = useRef<HTMLDivElement>(null);
  const [shadowUrl, setShadowUrl] = useState<string>("");
  useEffect(() => {
    const base = rootRef.current?.querySelector<HTMLElement>(".bf-base");
    if (!base) return;
    const bake = () => {
      const w = base.clientWidth, h = base.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const c = document.createElement("canvas");
      c.width = (w + 160) * dpr; c.height = (h + 160) * dpr;
      const ctx = c.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.shadowColor = "rgba(0,0,0,.14)";
      ctx.shadowBlur = 44;
      ctx.shadowOffsetY = 18;
      ctx.fillStyle = "#000";
      ctx.fillRect(80, 62, w, h);
      // Erase the box itself; only its shadow remains.
      ctx.shadowColor = "transparent";
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillRect(80, 62, w, h);
      setShadowUrl(c.toDataURL("image/png"));
    };
    bake();
    const ro = new ResizeObserver(bake);
    ro.observe(base);
    return () => ro.disconnect();
  }, [slices]);

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

  const controls = (
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
  );

  return (
    <div className="bf" ref={rootRef} style={{ ["--r" as any]: ratio, ["--shadow" as any]: shadowUrl ? `url(${shadowUrl})` : "none" }}>
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

      {slot ? createPortal(controls, slot) : controls}
      {node}
    </div>
  );
}
