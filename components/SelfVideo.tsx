"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A film we host ourselves.
 *
 * No YouTube: no compression to their bitrate, no branding, no suggested
 * videos at the end, nothing that can appear over the picture. The browser
 * picks the file — the phone-sized one on a phone, the full one on a desktop —
 * from the `sources` given, smallest last so `media` decides.
 *
 * Ambient films (the launch piece) autoplay muted and loop, as they did on
 * YouTube, with one tap for sound. Anything else waits behind its poster until
 * the visitor asks for it, so we never start talking at someone unprompted.
 */
export default function SelfVideo({
  src,
  srcSmall,
  poster,
  ambient = false,
  silent = false,
  label,
  className,
}: {
  src: string;
  srcSmall?: string;
  poster?: string;
  ambient?: boolean;
  /**
   * The file carries no audio track at all, so there is nothing to unmute.
   * Offering "Tap for sound" on a silent film is a promise that goes nowhere —
   * and three of those buttons in a row is clutter besides.
   */
  silent?: boolean;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(ambient);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v || !ambient) return;
    // Autoplay is only permitted while muted; if the browser still refuses,
    // the poster stays and the play control is there to press.
    v.muted = true;
    v.play().catch(() => setStarted(false));
  }, [ambient]);

  const play = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    setMuted(false);
    setStarted(true);
    v.play().catch(() => {});
  };

  const toggleSound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  return (
    <div className={`sv${started ? " on" : ""}${className ? ` ${className}` : ""}`}>
      <video
        ref={ref}
        poster={poster}
        playsInline
        loop={ambient}
        muted={muted}
        preload={ambient ? "auto" : "metadata"}
        controls={started && !ambient}
        aria-label={label}
      >
        {/* Phones take the smaller file; everything else the full-size one. */}
        {srcSmall && <source src={srcSmall} type="video/mp4" media="(max-width: 820px)" />}
        <source src={src} type="video/mp4" />
      </video>

      {!started && (
        <button className="sv-play" onClick={play} aria-label={label ? `Play ${label}` : "Play"}>
          <span />
        </button>
      )}

      {ambient && !silent && (
        <button className="sv-sound" onClick={toggleSound}>
          {muted ? "Tap for sound" : "Sound on"}
        </button>
      )}
    </div>
  );
}
