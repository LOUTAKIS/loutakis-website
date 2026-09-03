"use client";

import { useLightbox } from "./Lightbox";

/** A single large image (floorplan, board artwork) that opens full screen on tap. */
export default function Zoomable({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const { open, node } = useLightbox([{ src, alt }]);
  return (
    <>
      <button className={className ?? "vz"} onClick={() => open(0)} aria-label={`View ${alt} full screen`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} />
        <span>Tap to zoom</span>
      </button>
      {node}
    </>
  );
}
