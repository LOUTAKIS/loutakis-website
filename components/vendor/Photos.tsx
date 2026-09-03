"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLightbox } from "./Lightbox";

/**
 * The photographs, one at a time at the size the screen allows, with a
 * filmstrip beneath to move through the set. Order is the CRM order, which
 * is the portal order. Arrow keys and swipe work; tap the photo for full screen.
 */
export default function Photos({ photos }: { photos: { url: string }[] }) {
  const { open, node } = useLightbox(photos.map((p) => ({ src: p.url })));
  const [i, setI] = useState(0);
  // The frame takes the current photo's own proportions, so nothing is letterboxed.
  const [ar, setAr] = useState<Record<string, number>>({});
  const ratio = ar[photos[i]?.url] ?? 3 / 2;
  const stripRef = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);
  const n = photos.length;

  const go = useCallback((k: number) => setI(((k % n) + n) % n), [n]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go]);

  // Keep the current thumbnail in view.
  useEffect(() => {
    // Scroll the strip itself, never the page (scrollIntoView would move the page on load).
    const strip = stripRef.current;
    const el = strip?.children[i] as HTMLElement | undefined;
    if (!strip || !el) return;
    strip.scrollTo({ left: el.offsetLeft - strip.clientWidth / 2 + el.offsetWidth / 2, behavior: "smooth" });
  }, [i]);

  if (!n) return null;
  const next = photos[(i + 1) % n]?.url;
  const prev = photos[(i - 1 + n) % n]?.url;

  return (
    <div className="vp">
      <div
        className="vp-stage"
        style={{ aspectRatio: String(ratio), width: `min(100%, calc((var(--fit) - var(--strip) - 14px) * ${ratio}))` }}
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current == null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
          touch.current = null;
        }}
      >
        <button className="vp-main" onClick={() => open(i)} aria-label={`View photo ${i + 1} full screen`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[i].url}
            alt={`Photograph ${i + 1} of ${n}`}
            onLoad={(e) => {
              const im = e.currentTarget, key = photos[i].url;
              if (im.naturalWidth && im.naturalHeight) setAr((m) => (m[key] ? m : { ...m, [key]: im.naturalWidth / im.naturalHeight }));
            }}
          />
        </button>
        {n > 1 && (
          <>
            <button className="vp-arrow prev" onClick={() => go(i - 1)} aria-label="Previous photograph">‹</button>
            <button className="vp-arrow next" onClick={() => go(i + 1)} aria-label="Next photograph">›</button>
          </>
        )}
        {/* Neighbours decoded ahead of time so paging is instant. */}
        <link rel="preload" as="image" href={next} />
        <link rel="preload" as="image" href={prev} />
      </div>

      <div className="vp-bar">
        <span className="vp-count">{i + 1} / {n}</span>
        <div className="vp-strip" ref={stripRef} role="tablist" aria-label="Photographs">
          {photos.map((p, k) => (
            <button key={p.url} role="tab" aria-selected={k === i} className={k === i ? "on" : ""} onClick={() => go(k)} aria-label={`Photograph ${k + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      </div>
      {node}
    </div>
  );
}
