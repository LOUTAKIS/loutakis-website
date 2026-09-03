"use client";

import Zoomable from "./Zoomable";

/**
 * The signboard.
 *
 * With a street scene supplied (public/vendor/board-scene.jpg plus the four
 * corners of the board face in BOARD_SCENE), the artwork is projected onto the
 * board in the photo — the vendor sees it on a fence, not as a flat file.
 * Until that photo exists, the artwork is shown large on its own. Either way,
 * tap to zoom shows the real artwork at full size for the fine print.
 */

/**
 * Corners of the board face in the scene photo, as fractions of its width and
 * height: top-left, top-right, bottom-right, bottom-left. Set once, when the
 * photo is chosen. Null = no scene yet.
 */
const BOARD_SCENE: null | {
  src: string;
  width: number;
  height: number;
  quad: [[number, number], [number, number], [number, number], [number, number]];
} = null;

export default function Board({ src }: { src: string }) {
  if (!BOARD_SCENE) {
    return <Zoomable src={src} alt="Signboard artwork" className="vz vz-board" />;
  }

  const { src: scene, width, height, quad } = BOARD_SCENE;
  // A CSS 3D projection onto the quad is approximate; it is a mock-up, and
  // the zoom shows the true artwork. Corners are mapped with a matrix3d.
  const style = { ["--m" as any]: quadToMatrix(quad, width, height) } as React.CSSProperties;

  return (
    <div className="vboard" style={{ aspectRatio: `${width} / ${height}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="vboard-scene" src={scene} alt="" />
      <div className="vboard-face" style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Signboard artwork on the board" />
      </div>
      <div className="vboard-zoom">
        <Zoomable src={src} alt="Signboard artwork" className="vz vz-inline" />
      </div>
    </div>
  );
}

/** Homography from the unit square to `quad` (fractions), as a CSS matrix3d string. */
function quadToMatrix(
  q: [[number, number], [number, number], [number, number], [number, number]],
  w: number,
  h: number
): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q.map(([x, y]) => [x * w, y * h]) as typeof q;
  // Solve for the 8 unknowns of the projective transform (standard derivation).
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const hh = (dx1 * dy3 - dx3 * dy1) / det;
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3, f = y0;
  // matrix3d is column-major 4x4; map the 2D homography into it.
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
}
