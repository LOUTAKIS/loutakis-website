"use client";

import { useCallback, useEffect, useState } from "react";

export type LbImage = { src: string; alt?: string };

/**
 * Full-screen viewer on white. Arrow keys, swipe, a counter, tap outside to
 * close. Used by the photos, the floorplan, the board and the brochure pages,
 * so the vendor learns it once.
 */
export function useLightbox(images: LbImage[]) {
  const [index, setIndex] = useState<number | null>(null);
  const open = (i: number) => setIndex(i);
  const close = useCallback(() => setIndex(null), []);
  const prev = useCallback(() => setIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length)), [images.length]);
  const next = useCallback(() => setIndex((i) => (i === null ? i : (i + 1) % images.length)), [images.length]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [index, close, prev, next]);

  const node =
    index === null ? null : (
      <Lightbox images={images} index={index} onClose={close} onPrev={prev} onNext={next} />
    );
  return { open, node };
}

function Lightbox({
  images,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  images: LbImage[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [touchX, setTouchX] = useState<number | null>(null);
  const img = images[index];
  const many = images.length > 1;

  return (
    <div
      className="lb2"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={onClose}
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 50) (dx > 0 ? onPrev : onNext)();
        setTouchX(null);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.src} alt={img.alt ?? ""} onClick={(e) => e.stopPropagation()} />
      <button className="lb2-close" onClick={onClose} aria-label="Close">×</button>
      {many && (
        <>
          <button className="lb2-nav lb2-prev" onClick={(e) => { e.stopPropagation(); onPrev(); }} aria-label="Previous">‹</button>
          <button className="lb2-nav lb2-next" onClick={(e) => { e.stopPropagation(); onNext(); }} aria-label="Next">›</button>
          <div className="lb2-count">{index + 1} / {images.length}</div>
        </>
      )}
    </div>
  );
}
