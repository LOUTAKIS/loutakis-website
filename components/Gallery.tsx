"use client";

import { useState, useEffect, useCallback } from "react";

type Img = { url: string; alt: string };

export default function Gallery({ images }: { images: Img[] }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  const close = useCallback(() => setOpen(false), []);
  const prev = useCallback(
    () => setI((n) => (n - 1 + images.length) % images.length),
    [images.length]
  );
  const next = useCallback(
    () => setI((n) => (n + 1) % images.length),
    [images.length]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, prev, next]);

  if (images.length === 0) return null;
  const openAt = (n: number) => { setI(n); setOpen(true); };
  const thumbs = images.slice(1, 4); // the next 3 after the main

  return (
    <>
      {/*
       * Every photograph is shown whole. Each frame takes the photo's own
       * shape — plain <img> with the height fixed and the width free — so
       * there is never a band of empty space beside it, and the "+N more"
       * overlay sits exactly on the picture rather than on a larger box.
       * The hero and the row together are capped to the window height.
       */}
      <div className="gallery-fit">
        <button className="gf-hero" onClick={() => openAt(0)} aria-label="View photographs full screen">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[0].url} alt={images[0].alt} />
        </button>

        {thumbs.length > 0 && (
          <div className="gf-strip">
            {thumbs.map((img, n) => (
              <button className="gf-thumb" key={n} onClick={() => openAt(n + 1)} aria-label={`View photograph ${n + 2}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt} />
                {n === thumbs.length - 1 && images.length > 4 && (
                  <span className="more-overlay">+{images.length - 4} more</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {images.length > 1 && (
        <button className="btn" style={{ marginTop: 16 }} onClick={() => openAt(0)}>
          View all {images.length} photos
        </button>
      )}

      {open && (
        <div className="lightbox" onClick={close}>
          <button className="lb-close" onClick={close} aria-label="Close">×</button>
          <button className="lb-nav lb-prev" aria-label="Previous"
            onClick={(e) => { e.stopPropagation(); prev(); }}>‹</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lb-img" src={images[i].url} alt={images[i].alt}
            onClick={(e) => e.stopPropagation()} />
          <button className="lb-nav lb-next" aria-label="Next"
            onClick={(e) => { e.stopPropagation(); next(); }}>›</button>
          <div className="lb-count">{i + 1} / {images.length}</div>
        </div>
      )}
    </>
  );
}
