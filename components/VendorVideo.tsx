"use client";

/**
 * The film, with sound and controls — this is a review, not ambience. A plain
 * embed (not the API player) so the vendor gets play, scrub and full screen.
 */
export default function VendorVideo({ id }: { id: string }) {
  return (
    <div className="va-video">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&cc_load_policy=0&iv_load_policy=3`}
        title="Property video"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}
