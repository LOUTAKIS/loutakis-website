import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@vercel/global-config";

/**
 * The Instagram feed on the About page.
 *
 * Meta shut the Basic Display API down on 4 December 2024, so this uses the
 * Instagram API with Instagram Login (graph.instagram.com). It needs a
 * professional (Business or Creator) account and a long-lived token.
 *
 * THE TOKEN IS THE FRAGILE PART. Long-lived tokens last 60 days and must be
 * refreshed while still valid — one missed refresh and it cannot be recovered
 * without going back to Meta. So:
 *
 *   - INSTAGRAM_TOKEN in the environment is the SEED, set by hand once.
 *   - Every refresh writes the new token to the same Global Config store the
 *     portal and campaigns use, and that stored copy always wins.
 *   - The daily cron refreshes it, so the 60-day clock restarts every night
 *     and a fortnight of failures still leaves weeks of headroom.
 *
 * If any of it fails the page shows nothing rather than a broken grid — see
 * getInstagramPosts, which returns an empty array on every error path.
 */

const STORE_ID = process.env.GLOBAL_CONFIG_ID ?? "ecfg_y2dshgcsqthztqvi74jh0tqo1uzs";
const TEAM_ID = process.env.VERCEL_TEAM_ID ?? "team_P499DP8ocTP5k7vIJChVJiS1";
const API_TOKEN = process.env.VERCEL_API_TOKEN;
const client = process.env.GLOBAL_CONFIG ? createClient(process.env.GLOBAL_CONFIG) : null;

const TOKEN_KEY = "ig_token";

export type InstagramPost = {
  id: string;
  /** The picture to show. For a reel or video this is the poster frame. */
  image: string;
  permalink: string;
  isVideo: boolean;
  caption: string;
};

type StoredToken = { token: string; refreshedAt: string };

async function readStoredToken(): Promise<StoredToken | null> {
  if (API_TOKEN) {
    try {
      const res = await fetch(
        `https://api.vercel.com/v1/global-config/${STORE_ID}/item/${TOKEN_KEY}?teamId=${encodeURIComponent(TEAM_ID)}`,
        { headers: { Authorization: `Bearer ${API_TOKEN}` }, cache: "no-store" }
      );
      if (res.ok) {
        const json: any = await res.json();
        return (json?.value ?? null) as StoredToken | null;
      }
    } catch {
      // fall through to the SDK
    }
  }
  if (!client) return null;
  return (await client.get<StoredToken>(TOKEN_KEY).catch(() => undefined)) ?? null;
}

async function writeStoredToken(token: string): Promise<void> {
  if (!API_TOKEN) throw new Error("VERCEL_API_TOKEN not set — cannot store the refreshed token");
  const res = await fetch(
    `https://api.vercel.com/v1/global-config/${STORE_ID}/items?teamId=${encodeURIComponent(TEAM_ID)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            operation: "upsert",
            key: TOKEN_KEY,
            value: { token, refreshedAt: new Date().toISOString() } satisfies StoredToken,
          },
        ],
      }),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`token store write -> ${res.status} ${await res.text()}`);
}

/** The stored token if we have one, otherwise the seed from the environment. */
async function currentToken(): Promise<string | null> {
  const stored = await readStoredToken();
  return stored?.token || process.env.INSTAGRAM_TOKEN || null;
}

/**
 * Push the token's expiry out another 60 days.
 *
 * Meta requires the token to be at least 24 hours old and still valid. Called
 * nightly from the cron: refreshing more often than needed costs nothing, and
 * missing it entirely costs the feed.
 */
export async function refreshInstagramToken(): Promise<{ ok: boolean; detail: string }> {
  const token = await currentToken();
  if (!token) return { ok: false, detail: "no token set" };

  try {
    const res = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json?.access_token) {
      return { ok: false, detail: `refresh -> ${res.status} ${JSON.stringify(json).slice(0, 200)}` };
    }
    await writeStoredToken(json.access_token);
    const days = Math.round(Number(json.expires_in ?? 0) / 86400);
    return { ok: true, detail: `token refreshed, valid ~${days} days` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "unknown error" };
  }
}

/**
 * Pinned deliberately. graph.instagram.com without a version follows Meta's
 * latest, which changes under us; a pinned one fails loudly on a known date
 * instead. Bump it when Meta deprecates this version.
 */
const GRAPH = "https://graph.instagram.com/v26.0";

/**
 * Shared with the diagnostic on purpose. Asking Instagram a different question
 * there than the page asks here is how a "working" diagnostic sits next to an
 * empty row: the fields you request decide what comes back.
 */
const MEDIA_FIELDS = "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp";

/**
 * Ask for far more than we show, then sort.
 *
 * The API returned a page of mid-2025 posts when the newest were wanted, so its
 * order is not something to rely on. Over-fetching and sorting by the real
 * timestamp makes the row correct whatever order Instagram chooses, and costs
 * nothing extra — it is one request either way, cached for an hour.
 */
const FETCH_WINDOW = 50;

async function fetchPosts(limit: number): Promise<InstagramPost[]> {
  const token = await currentToken();
  if (!token) return [];

  /**
   * Two calls, as the documentation shows: resolve the professional account's
   * id, then read that account's media. Cached hourly with everything else, so
   * the extra hop costs one request an hour.
   */
  const meRes = await fetch(
    `${GRAPH}/me?fields=user_id&access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" }
  );
  if (!meRes.ok) {
    console.error(`[instagram] me -> ${meRes.status} ${(await meRes.text()).slice(0, 200)}`);
    return [];
  }
  const me: any = await meRes.json();
  // The docs show this both bare and wrapped in `data`, so accept either.
  const userId = String(me?.user_id ?? me?.data?.[0]?.user_id ?? me?.id ?? "");
  if (!userId) {
    console.error("[instagram] no user_id in /me response");
    return [];
  }

  const res = await fetch(
    `${GRAPH}/${userId}/media?fields=${MEDIA_FIELDS}&limit=${FETCH_WINDOW}&access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    console.error(`[instagram] media -> ${res.status} ${(await res.text()).slice(0, 200)}`);
    return [];
  }

  const json: any = await res.json();
  const data: any[] = Array.isArray(json?.data) ? json.data : [];

  return data
    .slice()
    // Newest first, by Instagram's own timestamp rather than by the order it
    // happened to send. Anything undated sinks rather than jumping the queue.
    .sort((a, b) => Date.parse(b?.timestamp ?? 0) - Date.parse(a?.timestamp ?? 0))
    .map((m) => {
      // Reels come through as VIDEO; a carousel shows its cover image.
      const isVideo = m.media_type === "VIDEO";
      // A video has no still of its own in media_url — that's the mp4 — so the
      // thumbnail is the only thing safe to put in an <img>.
      const image = isVideo ? m.thumbnail_url : m.media_url;
      return {
        id: String(m.id),
        image: typeof image === "string" ? image : "",
        permalink: typeof m.permalink === "string" ? m.permalink : "",
        isVideo,
        caption: typeof m.caption === "string" ? m.caption : "",
      };
    })
    .filter((p) => p.image && p.permalink)
    .slice(0, limit);
}

/**
 * The latest posts, cached for an hour.
 *
 * Instagram's image URLs are signed and expire in a day or so, which is why
 * this is cached in hours rather than days — a stale cache would render a row
 * of broken pictures.
 */
const cachedPosts = unstable_cache(
  (limit: number) => fetchPosts(limit),
  ["instagram", "media"],
  { revalidate: 3600, tags: ["instagram"] }
);

export async function getInstagramPosts(limit = 6): Promise<InstagramPost[]> {
  try {
    return await cachedPosts(limit);
  } catch (err) {
    // Never let the feed take the page down with it.
    console.error("[instagram] fetch failed", err);
    return [];
  }
}

/**
 * A safe account of why the feed is or isn't working.
 *
 * Never returns the token — only whether one exists and where it came from —
 * so it can be read from a browser without leaking anything. Bypasses the
 * hourly cache deliberately: the question is what Instagram says *now*.
 */
export async function instagramDiagnostics(): Promise<Record<string, unknown>> {
  const stored = await readStoredToken().catch(() => null);
  const envToken = process.env.INSTAGRAM_TOKEN ?? "";
  const token = stored?.token || envToken || "";

  const out: Record<string, unknown> = {
    tokenInStore: Boolean(stored?.token),
    storeRefreshedAt: stored?.refreshedAt ?? null,
    tokenInEnv: Boolean(envToken),
    envTokenLength: envToken.length,
    usingToken: token ? (stored?.token ? "store" : "env") : "none",
    graph: GRAPH,
  };
  if (!token) {
    out.verdict = "No token at all — INSTAGRAM_TOKEN is not reaching the server.";
    return out;
  }

  /**
   * What the PAGE gets, not what Instagram gives.
   *
   * Everything else here talks to Instagram directly and so proves only that
   * the account and token are fine. The row calls getInstagramPosts, which goes
   * through the hourly cache — so if this number is 0 while the calls below all
   * succeed, the cache is the culprit and not the API.
   *
   * Calling it also warms that cache, which is a side effect worth knowing
   * about: a 0 here can become a 6 on the next read.
   */
  out.pageWouldRender = await getInstagramPosts(6)
    .then((p) => p.length)
    .catch((e) => `threw: ${e instanceof Error ? e.message : String(e)}`);

  try {
    const meRes = await fetch(
      `${GRAPH}/me?fields=user_id,username,account_type,media_count&access_token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    const meText = await meRes.text();
    out.meStatus = meRes.status;
    out.meBody = meText.slice(0, 400);
    if (!meRes.ok) {
      out.verdict = "The token is rejected by Instagram — see meBody.";
      return out;
    }

    const me = JSON.parse(meText);
    const userId = String(me?.user_id ?? me?.data?.[0]?.user_id ?? me?.id ?? "");
    out.resolvedUserId = userId || null;
    out.username = me?.username ?? me?.data?.[0]?.username ?? null;
    if (!userId) {
      out.verdict = "Instagram answered but gave no user_id — the field name may have changed.";
      return out;
    }

    const mediaRes = await fetch(
      `${GRAPH}/${userId}/media?fields=id,media_type,permalink&limit=6&access_token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    const mediaText = await mediaRes.text();
    out.mediaStatus = mediaRes.status;
    out.mediaBody = mediaText.slice(0, 600);
    if (!mediaRes.ok) {
      out.verdict = "The account resolved but its media could not be read — see mediaBody.";
      return out;
    }

    const count = (JSON.parse(mediaText)?.data ?? []).length;
    out.mediaCount = count;
    if (!count) {
      out.verdict = "Token works but the account returned no media.";
      return out;
    }

    /**
     * The question that actually matters: not "does Instagram answer?" but
     * "does what it answers survive being turned into a tile?".
     *
     * The row drops any post with no picture, and a reel's only picture is
     * thumbnail_url. So this asks for the SAME fields the page asks for and
     * reports, per post, which of them came back — a feed of six reels with no
     * thumbnails looks identical to a working feed until you check this.
     */
    const renderRes = await fetch(
      `${GRAPH}/${userId}/media?fields=${MEDIA_FIELDS}&limit=${FETCH_WINDOW}&access_token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    const renderText = await renderRes.text();
    out.renderStatus = renderRes.status;
    if (!renderRes.ok) {
      out.renderBody = renderText.slice(0, 600);
      out.verdict =
        "The short field list works but the one the page uses is rejected — a field in MEDIA_FIELDS is the problem. See renderBody.";
      return out;
    }

    const items: any[] = JSON.parse(renderText)?.data ?? [];
    out.windowSize = items.length;
    /**
     * Dates, in the order Instagram sent them. If this list is not descending,
     * the API's order is not chronological and the sort in fetchPosts is what
     * puts the newest posts on the page.
     */
    out.asSentByInstagram = items.slice(0, 12).map((m) => m.timestamp ?? null);
    out.newest = items
      .map((m) => m.timestamp)
      .filter(Boolean)
      .sort()
      .slice(-3)
      .reverse();
    out.items = items.slice(0, 6).map((m) => ({
      media_type: m.media_type,
      timestamp: m.timestamp ?? null,
      hasMediaUrl: Boolean(m.media_url),
      hasThumbnail: Boolean(m.thumbnail_url),
      hasPermalink: Boolean(m.permalink),
    }));
    const renderable = items.filter(
      (m) => (m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url) && m.permalink
    ).length;
    out.renderable = renderable;

    /**
     * The account says 64 media; one page gave 10, the newest from June 2025.
     * So walk the pages and count. This answers the only question that matters:
     * does the API know about anything more recent, or does its view of the
     * account genuinely stop on that date?
     *
     * Bounded at five pages — this is a diagnostic, not a crawler.
     */
    let next: string | null = JSON.parse(renderText)?.paging?.next ?? null;
    const stamps: string[] = items.map((m) => m.timestamp).filter(Boolean);
    let pages = 1;
    while (next && pages < 5) {
      const pageRes = await fetch(next, { cache: "no-store" });
      if (!pageRes.ok) {
        out.pagingStoppedAt = `page ${pages + 1} -> ${pageRes.status}`;
        break;
      }
      const page = await pageRes.json();
      for (const m of page?.data ?? []) if (m?.timestamp) stamps.push(m.timestamp);
      next = page?.paging?.next ?? null;
      pages += 1;
    }
    stamps.sort();
    out.pagesWalked = pages;
    out.totalSeen = stamps.length;
    out.mediaCountClaimed = 64;
    out.oldestSeen = stamps[0] ?? null;
    out.newestSeen = stamps[stamps.length - 1] ?? null;
    out.morePagesRemain = Boolean(next);
    out.verdict = renderable
      ? `Working — ${renderable} of ${items.length} posts can be shown for @${out.username}.`
      : `Instagram returns ${items.length} posts but NONE has a usable picture, so the row hides itself — see items.`;
  } catch (err) {
    out.error = err instanceof Error ? err.message : String(err);
    out.verdict = "The request to Instagram threw — see error.";
  }
  return out;
}
