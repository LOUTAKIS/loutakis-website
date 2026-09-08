import { getInstagramPosts } from "@/lib/instagram";

const PROFILE = "https://www.instagram.com/loutakisrealestate/";

/**
 * Six posts in a row, live from Instagram.
 *
 * Renders nothing at all when the feed is unavailable — no token, an expired
 * one, or Meta having a bad day. A missing section is invisible; a row of
 * broken image icons is not.
 *
 * Plain <img> rather than next/image on purpose: Instagram's CDN URLs are
 * signed and short-lived, so putting them through our optimiser would cache a
 * URL that dies before the cache does.
 */
export default async function InstagramRow() {
  const posts = await getInstagramPosts(6);
  if (!posts.length) return null;

  return (
    <section className="ig">
      <div className="wrap">
        <div className="ig-head">
          <div className="eyebrow">Instagram</div>
          <h2 className="lead">Follow the journey</h2>
        </div>
        <div className="ig-row">
          {posts.map((p) => (
            <a
              key={p.id}
              className="ig-tile"
              href={p.permalink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={p.caption ? p.caption.slice(0, 120) : "View this post on Instagram"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt="" loading="lazy" />
              {p.isVideo && <span className="ig-play" aria-hidden="true" />}
            </a>
          ))}
        </div>
        <p className="ig-follow">
          <a href={PROFILE} target="_blank" rel="noopener noreferrer">
            @loutakisrealestate
          </a>
        </p>
      </div>
    </section>
  );
}
