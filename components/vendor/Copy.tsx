"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The copy, set like the page in a brochure. Select any run of words and a
 * small "Suggest a change" chip appears; tapping it quotes the selection into
 * the amendments box and scrolls there. Copy is the most-amended item, so the
 * path from "this sentence" to "tell Michael" should be one tap.
 */
export default function Copy({ heading, text }: { heading: string; text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [chip, setChip] = useState<{ x: number; y: number; quote: string } | null>(null);

  useEffect(() => {
    const onSelect = () => {
      const sel = window.getSelection();
      const s = sel?.toString().trim() ?? "";
      if (!sel || !s || s.length < 3 || !ref.current?.contains(sel.anchorNode)) {
        setChip(null);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setChip({ x: rect.left + rect.width / 2, y: rect.top + window.scrollY - 10, quote: s.slice(0, 300) });
    };
    document.addEventListener("selectionchange", onSelect);
    return () => document.removeEventListener("selectionchange", onSelect);
  }, []);

  const suggest = () => {
    if (!chip) return;
    window.dispatchEvent(new CustomEvent("vendor:suggest", { detail: chip.quote }));
    window.getSelection()?.removeAllRanges();
    setChip(null);
    document.getElementById("approve")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="vcopy" ref={ref}>
      {heading && <h3>{heading}</h3>}
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <p className="vp-note">Spotted something? Select the words and tap &ldquo;Suggest a change&rdquo;.</p>
      {chip && (
        <button
          className="vcopy-chip"
          style={{ left: chip.x, top: chip.y }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={suggest}
        >
          Suggest a change
        </button>
      )}
    </div>
  );
}
