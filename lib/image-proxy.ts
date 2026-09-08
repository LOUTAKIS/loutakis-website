import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Listing photographs, served from our own domain.
 *
 * Box & Dice are explicit in their API documentation:
 *
 *   "Do not hotlink image URLs in your applications. These URLs may change at
 *    any time, and we do not support third-party implementations using our
 *    bandwidth."
 *
 * So every photograph goes through /api/img instead. That keeps us on the right
 * side of their terms, puts the bytes behind our own CDN where they are cached
 * for a year, and means a changed asset URL is our problem to re-fetch rather
 * than a page full of broken images.
 *
 * TWO GUARDS, because a proxy that will fetch any URL is an open relay — free
 * bandwidth for anyone who finds it, with our domain's reputation attached:
 *
 *   1. the host must be Box & Dice's asset host, and
 *   2. the URL must carry a signature only this server can produce.
 */

const SECRET = process.env.PORTAL_TOKEN_SECRET ?? "";

/** The only host we will ever fetch on someone else's behalf. */
const ALLOWED_HOST = "assets.boxdice.com.au";

function sign(url: string): string {
  return createHmac("sha256", SECRET).update(`img:${url}`).digest("base64url").slice(0, 24);
}

function allowed(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === ALLOWED_HOST || u.hostname.endsWith(`.${ALLOWED_HOST}`));
  } catch {
    return false;
  }
}

/**
 * The URL to put in an <img src>. Anything we cannot or should not proxy is
 * returned untouched, so a listing never loses its photographs to a config
 * mistake — it just falls back to the old behaviour for that one image.
 */
export function proxied(url: string): string {
  if (!url || !SECRET || !allowed(url)) return url;
  return `/api/img?u=${encodeURIComponent(url)}&s=${sign(url)}`;
}

/**
 * The Box & Dice URL behind one of our proxy URLs.
 *
 * The dimension reader measures the original directly rather than going back
 * out through our own proxy — one hop instead of two, and it does not need to
 * know this server's absolute address to do it.
 */
export function originalOf(url: string): string {
  if (!url.startsWith("/api/img?")) return url;
  const u = new URLSearchParams(url.slice(url.indexOf("?") + 1)).get("u");
  return u && allowed(u) ? u : url;
}

/** True when this signature was minted by us for this exact URL. */
export function verify(url: string, signature: string): boolean {
  if (!SECRET || !signature || !allowed(url)) return false;
  const expected = Buffer.from(sign(url));
  const given = Buffer.from(signature);
  // Same length first: timingSafeEqual throws on a mismatch.
  return expected.length === given.length && timingSafeEqual(expected, given);
}
