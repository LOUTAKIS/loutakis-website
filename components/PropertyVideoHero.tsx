"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Full-width immersive property video. Autoplays muted (browsers block
 * autoplay WITH sound), with a one-tap "Sound on" control.
 */
export default function PropertyVideoHero({ id }: { id: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const player = useRef<any>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const w = window as any;

    function create() {
      if (cancelled || !holder.current || !w.YT?.Player) return;
      player.current = new w.YT.Player(holder.current, {
        videoId: id,
        playerVars: { autoplay: 1, mute: 1, controls: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: (e: any) => {
            try { e.target.mute(); e.target.playVideo(); } catch {}
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

  function enableSound() {
    const p = player.current;
    if (!p) return;
    try { p.unMute(); p.setVolume(100); p.playVideo(); } catch {}
    setMuted(false);
  }

  return (
    <div className="video-hero">
      <div ref={holder} className="video-hero-frame" />
      {muted && (
        <button className="video-hero-sound" onClick={enableSound} aria-label="Turn on sound">
          Tap for sound
        </button>
      )}
    </div>
  );
}
