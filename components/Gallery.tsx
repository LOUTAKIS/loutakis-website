"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

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
      <div className="gallery-fit">
        <div className="detail-hero" style={{ cursor: "pointer" }} onClick={() => openAt(0)}>
          <Image src={images[0].url} alt={images[0].alt} fill priority sizes="100vw" style={{ objectFit: "cover" }} />
        </div>

        {thumbs.length > 0 && (
          <div className="gallery-strip">
            {thumbs.map((img, n) => (
              <div className="g" key={n} style={{ cursor: "pointer" }} onClick={() => openAt(n + 1)}>
                <Image src={img.url} alt={img.alt} fill sizes="33vw" style={{ objectFit: "cover" }} />
                {n === 2 && images.length > 4 && (
                  <div className="more-overlay">+{images.length - 4} more</div>
                )}
              </div>
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
