"use client";

import { useEffect, useRef, useState } from "react";
import { killCaptions } from "@/lib/yt-captions";

/**
 * Looping brand video with no YouTube chrome and a sound toggle.
 *
 * Uses the YouTube IFrame API rather than a plain embed so we can drive it
 * ourselves: start muted (browsers block autoplay with sound), restart on end,
 * and let the visitor turn sound on or off.
 *
 * cc_load_policy: 0 keeps captions off by default. Note a viewer whose own
 * YouTube account forces captions on can still override this — that setting
 * belongs to them, not to the page.
 */
export default function VideoEmbed({ id, title }: { id: string; title?: string }) {
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
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          rel: 0,
          playsinline: 1,
          fs: 0,
          disablekb: 1,
          iv_load_policy: 3,
          cc_load_policy: 0, // captions off
          loop: 1,
          playlist: id, // YouTube needs this for a single video to loop
        },
        events: {
          onReady: (e: any) => {
            try {
              e.target.mute();
              e.target.playVideo();
            } catch {}
            killCaptions(e.target);
          },
          onStateChange: (e: any) => {
            // 0 = ENDED. Restart explicitly; the loop param alone is unreliable.
            if (e.data === 0) {
              try { e.target.seekTo(0); e.target.playVideo(); } catch {}
            }
            // 1 = PLAYING. Captions can come back when playback (re)starts.
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

  function toggleSound() {
    const p = player.current;
    if (!p) return;
    try {
      if (muted) {
        p.unMute();
        p.setVolume(100);
        p.playVideo();
        setMuted(false);
      } else {
        p.mute();
        setMuted(true);
      }
    } catch {}
  }

  return (
    <div className="video-embed video-embed--ambient" title={title}>
      <div ref={holder} className="video-embed-frame" />
      <button
        className="video-hero-sound video-embed-sound"
        onClick={toggleSound}
        aria-label={muted ? "Turn on sound" : "Mute"}
      >
        {muted ? "Sound on" : "Mute"}
      </button>
    </div>
  );
}
