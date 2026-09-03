"use client";

import { useEffect, useState } from "react";
import { useLightbox } from "./Lightbox";

/**
 * Renders the brochure PDF page by page in the browser, so it reads like a
 * brochure on a phone instead of forcing a download. pdf.js does the work;
 * pages are drawn at 2× for retina and shown in order, tap to zoom.
 */
export default function BrochurePages({ src, name }: { src: string; name: string }) {
  const [pages, setPages] = useState<string[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const { open, node } = useLightbox(pages.map((p, i) => ({ src: p, alt: `Brochure page ${i + 1}` })));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ url: src }).promise;
        const out: string[] = [];
        for (let n = 1; n <= doc.numPages && n <= 24; n++) {
          const page = await doc.getPage(n);
          const scale = Math.min(2, 1600 / page.getViewport({ scale: 1 }).width);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport }).promise;
          out.push(canvas.toDataURL("image/jpeg", 0.88));
          if (cancelled) return;
          setPages([...out]);
        }
        if (!cancelled) setState("ready");
      } catch (err) {
        console.error("[brochure] render failed", err);
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

  return (
    <div className="vb">
      {pages.length === 0 && <div className="vb-loading">Preparing the brochure…</div>}
      <div className="vb-pages">
        {pages.map((p, i) => (
          <button key={i} className="vb-page" onClick={() => open(i)} aria-label={`Page ${i + 1}, tap to zoom`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p} alt={`Brochure page ${i + 1}`} />
            <span>{i + 1}</span>
          </button>
        ))}
      </div>
      {state === "ready" && (
        <p className="vp-note">
          {pages.length} page{pages.length === 1 ? "" : "s"}. Tap any page to zoom, or{" "}
          <a href={src} target="_blank" rel="noopener">open the PDF</a> ({name}).
        </p>
      )}
      {node}
    </div>
  );
}
