"use client";

import { useState } from "react";

/** YouTube facade: shows the thumbnail + play button, loads the player on click. */
export default function VideoEmbed({ id, title }: { id: string; title?: string }) {
  const [play, setPlay] = useState(false);
  return (
    <div className="video-embed">
      {play ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title ?? "Video"}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          className="video-embed-btn"
          onClick={() => setPlay(true)}
          aria-label="Play video"
          style={{ backgroundImage: `url(https://img.youtube.com/vi/${id}/maxresdefault.jpg)` }}
        >
          <span className="play" />
        </button>
      )}
    </div>
  );
}
