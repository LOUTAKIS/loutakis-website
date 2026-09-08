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

async function fetchPosts(limit: number): Promise<InstagramPost[]> {
  const token = await currentToken();
  if (!token) return [];

  const fields = "id,caption,media_type,media_url,permalink,thumbnail_url";
  const res = await fetch(
    `https://graph.instagram.com/me/media?fields=${fields}&limit=${limit}&access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    console.error(`[instagram] media -> ${res.status} ${(await res.text()).slice(0, 200)}`);
    return [];
  }

  const json: any = await res.json();
  const data: any[] = Array.isArray(json?.data) ? json.data : [];

  return data
    .map((m) => {
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
    .filter((p) => p.image && p.permalink);
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
