import "server-only";
import { createHmac } from "node:crypto";
import { downloadFile } from "./sharepoint";

/**
 * The brochure's eight panels as JPEGs, rendered on the server so the vendor's
 * phone gets pictures, not a PDF to rasterise.
 *
 * pdf.js runs in Node with @napi-rs/canvas (prebuilt Skia, no native build).
 * Rendered sets are kept in memory per server instance and the panel URLs
 * carry a signature so the CDN can cache them for a year: the URL changes if
 * the brochure file does, and cannot be guessed.
 *
 * PDF.JS 6 IS A CORRECTNESS REQUIREMENT, NOT HOUSEKEEPING. On 4.6.82 a soft-
 * masked gradient renders as a flat opaque block: the brochure cover's scrim,
 * which should fade from dark sky to clear by the roofline, came out as a
 * solid slab with a hard edge across the photograph. Measured down the sky at
 * 200dpi, the blue channel read 80, 77, 80, 82, 83, 84 — no gradient at all —
 * where the real file (checked against poppler) reads 61, 74, 112, 147, 185,
 * 221. On 6.3 it reads 80, 88, 123, 156, 191, 225 and tracks the original.
 *
 * A vendor approving their marketing has to be looking at their marketing, so
 * this is not cosmetic. 4.10 and 5.7 both segfault against Skia here; 6.3 is
 * the first version that renders it, and it requires @napi-rs/canvas 1.x —
 * pdf.js 6 hands it canvas types 0.1.x rejects outright.
 */

export type RenderedBrochure = { ratio: number; panels: Buffer[][] }; // [page][panel]

const SECRET = process.env.PORTAL_TOKEN_SECRET ?? "";

/** Stable, unguessable key for a campaign's brochure. */
export function panelSig(campaignId: string, brochureId: string): string {
  return createHmac("sha256", SECRET).update(`panels:${campaignId}:${brochureId}`).digest("hex").slice(0, 24);
}

export function panelUrls(campaignId: string, brochureId: string): string[][] {
  const sig = panelSig(campaignId, brochureId);
  return [0, 1].map((p) => [0, 1, 2, 3].map((k) => `/api/vendor/panel/${campaignId}/${sig}/${p}-${k}.jpg`));
}

const cache = new Map<string, Promise<RenderedBrochure>>();

export function renderBrochure(brochureId: string): Promise<RenderedBrochure> {
  let p = cache.get(brochureId);
  if (!p) {
    p = render(brochureId).catch((err) => {
      cache.delete(brochureId);
      throw err;
    });
    cache.set(brochureId, p);
  }
  return p;
}

async function render(brochureId: string): Promise<RenderedBrochure> {
  const res = await downloadFile(brochureId);
  const data = new Uint8Array(await res.arrayBuffer());

  const napi = await import("@napi-rs/canvas");
  const g = globalThis as any;
  g.DOMMatrix ??= napi.DOMMatrix;
  g.Path2D ??= napi.Path2D;
  g.ImageData ??= napi.ImageData;
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  class CanvasFactory {
    create(w: number, h: number) {
      const canvas = napi.createCanvas(w, h);
      return { canvas, context: canvas.getContext("2d") };
    }
    reset(cc: any, w: number, h: number) {
      cc.canvas.width = w;
      cc.canvas.height = h;
    }
    destroy(cc: any) {
      cc.canvas = null;
      cc.context = null;
    }
  }

  // `canvasFactory` at load time is untyped in v6 (it wants a CanvasFactory
  // class, not an instance) but is still honoured, and it is what routes every
  // internal canvas — masks and transparency groups included — through Skia
  // rather than a DOM that isn't here.
  const task = pdfjs.getDocument({ data, canvasFactory: new CanvasFactory(), useSystemFonts: true } as any);
  const doc = await task.promise;
  if (doc.numPages < 2) throw new Error(`brochure has ${doc.numPages} page(s); expected 2`);

  const panels: Buffer[][] = [];
  let ratio = 210 / 99;
  for (let n = 1; n <= 2; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, 2400 / base.width);
    const vp = page.getViewport({ scale });
    const W = Math.round(vp.width), H = Math.round(vp.height);
    const full = napi.createCanvas(W, H);
    // pdf.js 6 wants the canvas itself, not only its context.
    await page.render({ canvas: full as any, canvasContext: full.getContext("2d") as any, viewport: vp, canvasFactory: new CanvasFactory() } as any).promise;
    const pw = Math.floor(W / 4);
    if (n === 1) ratio = H / pw;
    const row: Buffer[] = [];
    for (let k = 0; k < 4; k++) {
      const slice = napi.createCanvas(pw, H);
      slice.getContext("2d").drawImage(full, k * pw, 0, pw, H, 0, 0, pw, H);
      row.push(await slice.encode("jpeg", 90));
    }
    panels.push(row);
  }
  // pdf.js 6 moved destroy() onto the loading task.
  await task.destroy();
  return { ratio, panels };
}
