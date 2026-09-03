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

  const doc = await pdfjs.getDocument({ data, canvasFactory: new CanvasFactory(), useSystemFonts: true }).promise;
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
    await page.render({ canvasContext: full.getContext("2d") as any, viewport: vp, canvasFactory: new CanvasFactory() } as any).promise;
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
  await doc.destroy();
  return { ratio, panels };
}
