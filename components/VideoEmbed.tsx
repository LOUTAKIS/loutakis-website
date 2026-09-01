/**
 * Background-style YouTube embed: autoplays, loops, no player chrome.
 *
 * Notes on the parameters, because several are load-bearing:
 *  - mute=1 is REQUIRED. Every modern browser blocks autoplay with sound, so
 *    without it the video simply never starts.
 *  - loop=1 does nothing on its own; YouTube needs `playlist` set to the same
 *    video id for a single video to repeat.
 *  - controls=0 hides the scrubber and buttons, fs=0 the fullscreen button,
 *    iv_load_policy=3 annotations, disablekb=1 keyboard control.
 *
 * The wrapper also sets pointer-events: none, so hovering or clicking can't
 * summon the YouTube UI or navigate the visitor away to youtube.com.
 */
export default function VideoEmbed({ id, title }: { id: string; title?: string }) {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    loop: "1",
    playlist: id,
    controls: "0",
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
    disablekb: "1",
    fs: "0",
    iv_load_policy: "3",
  });

  return (
    <div className="video-embed video-embed--ambient">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`}
        title={title ?? "Video"}
        allow="autoplay; encrypted-media; picture-in-picture"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
