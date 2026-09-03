"use client";

import { useLightbox } from "./Lightbox";

/**
 * The hero shot large, then a magazine rhythm — alternating two- and
 * three-across — so the set reads as a spread, not a contact sheet. Order is
 * the CRM order, which is the portal order.
 */
export default function Photos({ photos }: { photos: { url: string }[] }) {
  const { open, node } = useLightbox(photos.map((p) => ({ src: p.url })));
  if (!photos.length) return null;
  const [hero, ...rest] = photos;

  // Rows of 2, 3, 2, 3 … keeps the eye moving without looking random.
  const rows: { url: string; i: number }[][] = [];
  let i = 1;
  let size = 2;
  while (i <= rest.length) {
    rows.push(rest.slice(i - 1, i - 1 + size).map((p, k) => ({ url: p.url, i: i + k })));
    i += size;
    size = size === 2 ? 3 : 2;
  }

  return (
    <div className="vp">
      <button className="vp-hero" onClick={() => open(0)} aria-label="View photo 1 full screen">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={hero.url} alt="" />
      </button>
      {rows.map((row, r) => (
        <div key={r} className={`vp-row cols-${row.length}`}>
          {row.map((p) => (
            <button key={p.url} className="vp-cell" onClick={() => open(p.i)} aria-label={`View photo ${p.i + 1} full screen`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ))}
      <p className="vp-note">{photos.length} photographs, shown in the order they&rsquo;ll appear online. Tap any to view full screen.</p>
      {node}
    </div>
  );
}
