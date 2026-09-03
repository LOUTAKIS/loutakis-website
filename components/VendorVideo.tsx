"use client";

import { useEffect, useRef, useState } from "react";
import { killCaptions } from "@/lib/yt-captions";

/**
 * The film, presented as our film: a clean still with one play mark, sound
 * on from the first tap, and our own controls (play/pause, scrub, sound, full
 * screen). The YouTube frame is never interactive — no title bar, no
 * "Watch on YouTube", no suggestions — it just supplies the picture.
 */
export default function VendorVideo({ id, poster }: { id: string; poster?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const player = useRef<any>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const still = poster || `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    let timer = 0;
    const w = window as any;
    const create = () => {
      if (cancelled || !holder.current || !w.YT?.Player) return;
      player.current = new w.YT.Player(holder.current, {
        videoId: id,
        playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1, playsinline: 1, fs: 0, disablekb: 1, iv_load_policy: 3, cc_load_policy: 0 },
        events: {
          onReady: (e: any) => {
            try { e.target.unMute(); e.target.playVideo(); } catch {}
            killCaptions(e.target);
            setDur(e.target.getDuration?.() || 0);
            timer = window.setInterval(() => {
              try { setT(e.target.getCurrentTime() || 0); } catch {}
            }, 250);
          },
          onStateChange: (e: any) => {
            setPlaying(e.data === 1);
            if (e.data === 1) killCaptions(e.target);
            if (e.data === 0) { try { e.target.seekTo(0); e.target.pauseVideo(); } catch {} }
          },
        },
      });
    };
    if (w.YT?.Player) create();
    else {
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => { if (typeof prev === "function") prev(); create(); };
      if (!document.getElementById("yt-iframe-api")) {
        const s = document.createElement("script");
        s.id = "yt-iframe-api";
        s.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(s);
      }
    }
    return () => { cancelled = true; window.clearInterval(timer); try { player.current?.destroy?.(); } catch {} };
  }, [id, started]);

  const toggle = () => {
    const p = player.current;
    if (!p) return;
    try { playing ? p.pauseVideo() : p.playVideo(); } catch {}
  };
  const sound = () => {
    const p = player.current;
    if (!p) return;
    try { muted ? p.unMute() : p.mute(); } catch {}
    setMuted(!muted);
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const p = player.current;
    if (!p || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    try { p.seekTo(((e.clientX - r.left) / r.width) * dur, true); } catch {}
  };
  const full = () => {
    const el = box.current as any;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  };
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className={`vvid${started ? " on" : ""}${playing ? " playing" : ""}`} ref={box}>
      {!started ? (
        <button className="vvid-still" onClick={() => setStarted(true)} aria-label="Play the film" style={{ backgroundImage: `url(${still})` }}>
          <span className="vvid-play" />
        </button>
      ) : (
        <>
          <div className="vvid-frame" onClick={toggle}>
            <div ref={holder} />
          </div>
          <div className="vvid-bar">
            <button onClick={toggle} aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "▶"}</button>
            <div className="vvid-track" onClick={seek} role="slider" aria-valuemin={0} aria-valuemax={dur} aria-valuenow={t}>
              <i style={{ width: dur ? `${(t / dur) * 100}%` : 0 }} />
            </div>
            <span className="vvid-time">{mmss(t)}{dur ? ` / ${mmss(dur)}` : ""}</span>
            <button onClick={sound} aria-label={muted ? "Sound on" : "Sound off"}>{muted ? "Sound off" : "Sound on"}</button>
            <button onClick={full} aria-label="Full screen">⤢</button>
          </div>
        </>
      )}
    </div>
  );
}
