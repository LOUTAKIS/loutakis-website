"use client";

import { useState } from "react";

/**
 * A read-only instrument on the real brochure, for the Safari fold fault.
 *
 * WHY IT IS HERE. A standalone reproduction of the fold — the same markup, the
 * same CSS, the same stage machine, the interrupted fold-up, React's remount of
 * every panel, the blurred sticky header and the baked shadow — measures
 * perfectly in Safari. Whatever is wrong needs this page: its real panel JPEGs,
 * its real proportions, and everything around it. So the measurement has to
 * happen here.
 *
 * IT CHANGES NOTHING. It renders only when the URL carries ?probe=1, it reads
 * the DOM the brochure has already built, and it never touches the fold's own
 * state — the stages it steps through are the same ones the buttons set. With
 * the flag absent this is one boolean and an early return.
 */

type Row = { label: string; text: string };

const CARDS = ["base", "cover", "gateL", "gateR"] as const;

function cardEl(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.bf-${name}`);
}
function matrixOf(el: Element | null): string {
  return el ? getComputedStyle(el).transform || "none" : "gone";
}
function stageEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".bf-stage");
}

/** Drive the fold by its own control, so this measures what a vendor does. */
function press(): boolean {
  const btn = Array.from(document.querySelectorAll<HTMLButtonElement>(".bf-controls .btn")).find(
    (b) => !b.classList.contains("ghost")
  );
  if (!btn) return false;
  btn.click();
  return true;
}

function stageOf(): string {
  const el = stageEl();
  if (!el) return "?";
  return el.className.includes("s2") ? "s2" : el.className.includes("s1") ? "s1" : "s0";
}

/** Which panel the browser says is on top, across the width of the fold. */
function paintLine(): string {
  const el = stageEl();
  if (!el) return "no stage";
  const r = el.getBoundingClientRect();
  // Clamped into the window: the brochure is taller than the viewport on this
  // page, and a sample point off-screen reads as nothing and looks like a bug.
  const y = Math.min(Math.max(r.top + r.height / 2, 80), window.innerHeight - 20);
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const x = r.left + ((i + 0.5) * r.width) / 12;
    const hit = document.elementFromPoint(x, y);
    const face = hit?.closest?.(".bf-face") as HTMLElement | null;
    if (!face) { out.push("·"); continue; }
    const img = face.querySelector("img");
    const src = img?.getAttribute("src") ?? "";
    // The panel's own name: "…/0-2.jpg" is page 0, panel 2.
    const m = src.match(/\/(\d)-(\d)\.jpg/);
    out.push(m ? `p${m[1]}-${m[2]}` : face.className.includes("rear") ? "rear" : "front");
  }
  const runs: { name: string; n: number }[] = [];
  for (const n of out) {
    const last = runs[runs.length - 1];
    if (last && last.name === n) last.n++;
    else runs.push({ name: n, n: 1 });
  }
  return runs.map((x) => (x.n > 1 ? `${x.name} ×${x.n}` : x.name)).join("   ");
}

export default function FoldProbe() {
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState("");

  async function run() {
    setRunning(true);
    const found: Row[] = [];

    const el = stageEl();
    found.push({
      label: "page",
      text: `${location.pathname}   ${window.innerWidth}×${window.innerHeight}   dpr ${window.devicePixelRatio}`,
    });
    found.push({ label: "ua", text: navigator.userAgent });
    found.push({
      label: "vars",
      text: el
        ? `--r ${getComputedStyle(el).getPropertyValue("--r").trim() || "(unset)"}   ` +
          `--wf ${getComputedStyle(el).getPropertyValue("--wf").trim()}   ` +
          `--dur ${getComputedStyle(el).getPropertyValue("--dur").trim()}   ` +
          `shadow ${getComputedStyle(el).getPropertyValue("--shadow").trim() ? "baked" : "none"}`
        : "no stage element",
    });
    found.push({ label: "at rest", text: `${stageOf()}   ${paintLine()}` });

    // Three presses: open, open fully, fold up. Each one sampled every frame.
    for (const step of ["press 1 — open it", "press 2 — open fully", "press 3 — fold it up"]) {
      const before = stageOf();
      const last: Record<string, string> = {};
      const first: Record<string, number> = {};
      const settle: Record<string, number> = {};
      const frames: Record<string, number> = {};
      for (const n of CARDS) { last[n] = matrixOf(cardEl(n)); frames[n] = 0; }

      await new Promise<void>((resolve) => {
        requestAnimationFrame((start) => {
          if (!press()) { resolve(); return; }
          const tick = (t: number) => {
            const dt = t - start;
            for (const n of CARDS) {
              const m = matrixOf(cardEl(n));
              if (m !== last[n]) {
                if (first[n] === undefined) first[n] = dt;
                settle[n] = dt;
                frames[n]++;
                last[n] = m;
              }
            }
            if (dt < 2600) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
      });

      found.push({
        label: step,
        text:
          `${before} → ${stageOf()}\n` +
          CARDS.map(
            (n) =>
              `    ${(n + "      ").slice(0, 7)} starts ${
                first[n] === undefined ? "—" : Math.round(first[n]) + "ms"
              }`.padEnd(30) +
              ` settles ${settle[n] === undefined ? "—" : Math.round(settle[n]) + "ms"}`.padEnd(20) +
              ` frames ${frames[n]}` +
              (frames[n] > 0 && frames[n] < 8 ? "   <-- JUMPED" : "")
          ).join("\n") +
          `\n    painted: ${paintLine()}`,
      });
    }

    setRows(found);
    setRunning(false);
  }

  const report = ["BROCHURE FOLD — LIVE PAGE"]
    .concat(rows.map((r) => `${r.label}: ${r.text}`))
    .join("\n");

  return (
    <div className="foldprobe">
      <div className="foldprobe-bar">
        <strong>Fold probe</strong>
        <button className="btn" onClick={run} disabled={running}>
          {running ? "Measuring…" : "Run"}
        </button>
        {rows.length > 0 && (
          <button
            className="btn ghost"
            onClick={() => {
              navigator.clipboard?.writeText(report).then(
                () => setCopied("copied"),
                () => setCopied("select the text below and press ⌘C")
              );
            }}
          >
            Copy
          </button>
        )}
        <span>{copied}</span>
      </div>
      {rows.length > 0 && <pre>{report}</pre>}
    </div>
  );
}
