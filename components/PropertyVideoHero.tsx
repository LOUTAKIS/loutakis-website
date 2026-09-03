"use client";

import { useEffect, useRef, useState } from "react";
import { killCaptions } from "@/lib/yt-captions";

/**
 * Full-width property film.
 *
 * Autoplays muted (browsers block autoplay with sound) and loops, with a
 * one-tap sound control.
 *
 * As the page scrolls the hero stays put and washes out, and the content
 * slides up over it — the film becomes the backdrop instead of a thing you
 * scroll past. A cue at the bottom says there's more below, because a
 * full-screen video otherwise reads as the whole page.
 */
export default function PropertyVideoHero({ id }: { id: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const player = useRef<any>(null);
  const [muted, setMuted] = useState(true);
  /** 0 at the top, 1 once scrolled a screen — drives the wash and the cue. */
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const w = window as any;

    function create() {
      if (cancelled || !holder.current || !w.YT?.Player) return;
      player.current = new w.YT.Player(holder.current, {
        videoId: id,
        playerVars: {
          autoplay: 1, mute: 1, controls: 0, rel: 0, modestbranding: 1,
          playsinline: 1, fs: 0, disablekb: 1, iv_load_policy: 3,
          cc_load_policy: 0, // captions off
          loop: 1,
          playlist: id, // YouTube needs this for a single video to loop
        },
        events: {
          onReady: (e: any) => {
            try { e.target.mute(); e.target.playVideo(); } catch {}
            killCaptions(e.target);
          },
          onStateChange: (e: any) => {
            // 0 = ENDED. The loop param alone is unreliable on the iframe API,
            // so restart explicitly — otherwise it parks on a replay button.
            if (e.data === 0) {
              try { e.target.seekTo(0); e.target.playVideo(); } catch {}
            }
            // 1 = PLAYING. Captions can reload whenever playback restarts.
            if (e.data === 1) killCaptions(e.target);
          },
        },
      });
    }

    if (w.YT?.Player) {
      create();
    } else {
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        if (typeof prev === "function") prev();
        create();
      };
      if (!document.getElementById("yt-iframe-api")) {
        const s = document.createElement("script");
        s.id = "yt-iframe-api";
        s.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(s);
      }
    }

    return () => {
      cancelled = true;
      try { player.current?.destroy?.(); } catch {}
    };
  }, [id]);

  // Scroll position drives the wash. rAF-throttled so it can't cost a frame.
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const span = Math.max(window.innerHeight * 0.75, 1);
        setProgress(Math.min(window.scrollY / span, 1));
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function enableSound() {
    const p = player.current;
    if (!p) return;
    try { p.unMute(); p.setVolume(100); p.playVideo(); } catch {}
    setMuted(false);
  }

  return (
    <div className="video-hero" style={{ ["--wash" as any]: progress }}>
      <div ref={holder} className="video-hero-frame" />

      {/* Whites out as you scroll, so the content above it stays readable. */}
      <div className="video-hero-wash" aria-hidden="true" />

      {muted && progress < 0.5 && (
        <button className="video-hero-sound" onClick={enableSound} aria-label="Turn on sound">
          Tap for sound
        </button>
      )}

      <div className="video-hero-cue" aria-hidden="true">
        <span>Scroll</span>
        <i />
      </div>
    </div>
  );
}
