import "server-only";
import { unstable_cache } from "next/cache";

/**
 * How big is this photograph?
 *
 * The Box & Dice API returns images as { index, url } and nothing else — no
 * width, no height. Without them the gallery cannot be laid out until the
 * browser has downloaded every photo and measured it, which is why a cold load
 * showed the thumbnail column overrunning the page.
 *
 * So we read the dimensions ourselves, from the file's own header. Every format
 * the CRM serves states its size in the first few hundred bytes, so a range
 * request for 64KB is enough — we never download the whole photograph.
 *
 * A given URL's dimensions can never change (Box & Dice mints a new URL when a
 * photo changes), so the answer is cached for a month and costs one request per
 * image, ever.
 */

export type ImageSize = { w: number; h: number };

/* ── Reading the header ──────────────────────────────────────────────────── */

function png(b: Buffer): ImageSize | null {
  // 89 P N G \r \n 1a \n, then IHDR with width and height as big-endian uint32.
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function webp(b: Buffer): ImageSize | null {
  if (b.length < 30 || b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8X") return { w: (b.readUIntLE(24, 3) & 0xffffff) + 1, h: (b.readUIntLE(27, 3) & 0xffffff) + 1 };
  if (kind === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (kind === "VP8L") {
    const n = b.readUInt32LE(21);
    return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function jpeg(b: Buffer): ImageSize | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;

  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xff) {
      i++; // resynchronise rather than give up: padding bytes are legal here
      continue;
    }
    const marker = b[i + 1];

    // Standalone markers carry no length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    // Start Of Frame — every variant except the four that aren't frames at all.
    const isSOF = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc, 0xd8].includes(marker);
    if (isSOF) {
      // length(2) precision(1) height(2) width(2)
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    }
    const len = b.readUInt16BE(i + 2);
    if (len < 2) return null; // malformed; stop rather than loop forever
    i += 2 + len;
  }
  return null;
}

/** The dimensions stated in the file's header, whatever format it is. */
export function readImageSize(bytes: Buffer): ImageSize | null {
  const size = jpeg(bytes) ?? png(bytes) ?? webp(bytes);
  if (!size || !size.w || !size.h) return null;
  // A nonsense answer is worse than none: it would be baked into the layout.
  if (size.w > 30000 || size.h > 30000) return null;
  return size;
}

/* ── Fetching just enough of the file ────────────────────────────────────── */

async function fetchSize(url: string): Promise<ImageSize | null> {
  try {
    // Ask for the first 64KB only. A JPEG's frame header sits well inside that,
    // even after a fat EXIF block, and it saves pulling a 4MB photograph.
    const res = await fetch(url, {
      headers: { Range: "bytes=0-65535" },
      cache: "no-store",
    });
    if (!res.ok && res.status !== 206) {
      console.error(`[image-meta] ${res.status} for ${url}`);
      return null;
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    return readImageSize(bytes);
  } catch (err) {
    console.error("[image-meta] fetch failed", url, err);
    return null;
  }
}

/**
 * Cached per URL for a month.
 *
 * Keyed on the URL itself, so two listings sharing a photo measure it once, and
 * a re-deploy does not re-measure anything — the Data Cache outlives it.
 */
const cachedSize = unstable_cache(
  async (url: string) => await fetchSize(url),
  ["image-size"],
  { revalidate: 60 * 60 * 24 * 30, tags: ["image-meta"] }
);

export async function imageSize(url: string): Promise<ImageSize | null> {
  if (!url) return null;
  try {
    return await cachedSize(url);
  } catch {
    return null;
  }
}

/**
 * Measure several at once.
 *
 * Returns null for any that could not be read rather than throwing: a gallery
 * missing one ratio still lays out, it just falls back to measuring that one in
 * the browser as before.
 */
export async function imageSizes(urls: string[]): Promise<(ImageSize | null)[]> {
  return Promise.all(urls.map((u) => imageSize(u)));
}
