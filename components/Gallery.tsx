"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

type Img = { url: string; alt: string; w?: number; h?: number };

export default function Gallery({ images }: { images: Img[] }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  const close = useCallback(() => setOpen(false), []);
  const prev = useCallback(
    () => setI((n) => (n - 1 + images.length) % images.length),
    [images.length]
  );
  const next = useCallback(
    () => setI((n) => (n + 1) % images.length),
    [images.length]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, prev, next]);

  const openAt = (n: number) => { setI(n); setOpen(true); };
  const thumbs = images.slice(1, 4); // the next 3 after the main

  /**
   * The gallery is set the way a picture editor would set it: every photograph
   * keeps its own proportions, nothing is cropped, and no edge is left ragged.
   *
   *   Wide screens  — the hero fills the height on the left, with the three
   *                   others stacked beside it, all sharing one width so the
   *                   right-hand edge is straight.
   *   Narrower      — the hero on top, the three justified into a row that
   *                   comes to exactly the hero's width.
   *
   * Either way the whole block fits inside the window.
   */
  const boxRef = useRef<HTMLDivElement>(null);

  /**
   * The photographs' proportions, known BEFORE any of them download.
   *
   * The server reads each file's header and sends w/h with the listing
   * (lib/image-meta), so the arrangement can be solved on the very first render
   * instead of waiting for four photographs to arrive and measuring them. That
   * wait was the whole bug: on a cold load the thumbnail column had no settled
   * height and ran over the address and the enquiry panel beneath it.
   *
   * onLoad still fills in anything the server could not measure, so one
   * unreadable file degrades to the old behaviour for that image alone.
   */
  const known = useMemo(() => {
    const m: Record<string, number> = {};
    for (const im of images) if (im.w && im.h) m[im.url] = im.w / im.h;
    return m;
  }, [images]);
  const [ratios, setRatios] = useState<Record<string, number>>(known);
  const [size, setSize] = useState<
    | { mode: "row"; hero: number; strip: number }
    | { mode: "side"; heroW: number; heroH: number; thumbW: number }
    | null
  >(null);
  const GAP = 10;
  const SIDE_AT = 1180; // wide enough for the hero and a column beside it

  /**
   * Which arrangement, decided on the width alone and settled before the
   * photographs load. The exact sizes still wait for each image's shape, but
   * the direction must not: otherwise the gallery paints stacked and then
   * jumps sideways once the pictures arrive.
   */
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const check = () => setWide(window.innerWidth >= SIDE_AT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /**
   * The gallery's rendered width, published as a CSS variable so the rest of
   * the page can line up with the photographs' edges rather than the page
   * gutter. Cleared on unmount so no other page inherits it.
   */
  const publishWidth = (w: number) =>
    document.documentElement.style.setProperty("--gallery-width", `${Math.round(w)}px`);
  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty("--gallery-width");
    };
  }, []);

  const noteRatio = (url: string) => (e: React.SyntheticEvent<HTMLImageElement>) => {
    const im = e.currentTarget;
    if (!im.naturalWidth || !im.naturalHeight) return;
    const r = im.naturalWidth / im.naturalHeight;
    setRatios((m) => (m[url] ? m : { ...m, [url]: r }));
  };

  useEffect(() => {
    const rHero = ratios[images[0]?.url];
    const rs = thumbs.map((t) => ratios[t.url]) as number[];
    if (!rHero || rs.some((r) => !r)) return; // wait until every shape is known

    const measure = () => {
      const box = boxRef.current;
      if (!box) return;
      /**
       * The budget is a screenful, less the sticky header and a breath top and
       * bottom. It must NOT be derived from where the block sits in the
       * document: on a listing with a video hero the gallery begins a full
       * screen down, and "from here to the bottom of the window" then collapses
       * to nothing.
       */
      const header = document.querySelector<HTMLElement>(".nav")?.offsetHeight ?? 78;
      const H = Math.max(360, window.innerHeight - header - 96);
      const W = box.clientWidth;
      if (!W) return;
      if (!thumbs.length) return setSize({ mode: "row", hero: H, strip: 0 });

      if (wide) {
        /**
         * Hero on the left, the other three stacked on the right. All three
         * share one width, so their right edges line up and their heights sum
         * to the hero's height exactly. If that arrangement is wider than the
         * page, everything shrinks by the same factor and the block's own
         * height comes down with it — otherwise the container keeps its full
         * height and leaves a band of empty space underneath.
         */
        const gaps = GAP * (thumbs.length - 1);
        const inverse = rs.reduce((a, r) => a + 1 / r, 0);
        const heroH0 = H;
        const thumbW0 = (heroH0 - gaps) / inverse;
        const total = rHero * heroH0 + GAP + thumbW0;
        const heroH = total > W ? heroH0 * (W / total) : heroH0;
        const thumbW = (heroH - gaps) / inverse;
        const heroW = rHero * heroH;
        publishWidth(heroW + GAP + thumbW);
        return setSize({ mode: "side", heroW, heroH, thumbW });
      }

      const S = rs.reduce((a, r) => a + r, 0);
      const gaps = GAP * (thumbs.length - 1);
      // heroWidth = rHero * heroHeight, and stripHeight * S + gaps = heroWidth,
      // with heroHeight + GAP + stripHeight = H. Solve for stripHeight:
      const strip = (rHero * (H - GAP) - gaps) / (S + rHero);
      const hero = H - GAP - strip;
      if (strip > 24 && hero > 80) {
        publishWidth(rHero * hero);
        setSize({ mode: "row", hero, strip });
      }
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ratios, images, thumbs, wide]);

  if (images.length === 0) return null;

  return (
    <>
      {/*
       * Every photograph is shown whole. Each frame takes the photo's own
       * shape — plain <img> with the height fixed and the width free — so
       * there is never a band of empty space beside it, and the "+N more"
       * overlay sits exactly on the picture rather than on a larger box.
       * The hero and the row together are capped to the window height.
       */}
      <div
        /**
         * `gf-measuring` until every photograph's shape is known.
         *
         * Before that the strip is told to be 100% tall while its images are
         * height:auto, so the column runs longer than the box and spills over
         * the address and the agent card beneath it. Cached images resolve in
         * the same frame and it is never seen; a hard refresh shows it for as
         * long as the photos take to arrive.
         *
         * The clip lasts only for that moment. Once measured the class is gone
         * and every photograph is shown whole, which is the rule everywhere.
         */
        className={`gallery-fit${wide ? " gf-side" : ""}${size ? "" : " gf-measuring"}`}
        ref={boxRef}
        // In side mode the block is exactly as tall as the hero — no dead space.
        style={
          size?.mode === "side" && wide
            ? { gap: GAP, height: size.heroH }
            : size?.mode === "row" && !wide
              ? { gap: GAP, height: size.hero + GAP + size.strip }
              : { gap: GAP }
        }
      >
        <button
          className="gf-hero"
          onClick={() => openAt(0)}
          aria-label="View photographs full screen"
          style={
            size?.mode === "side" && wide
              ? { width: size.heroW, height: size.heroH, flex: "0 0 auto" }
              : size?.mode === "row" && !wide
                ? { height: size.hero, flex: "0 0 auto" }
                : undefined
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[0].url}
            alt={images[0].alt}
            width={images[0].w}
            height={images[0].h}
            onLoad={noteRatio(images[0].url)}
          />
        </button>

        {thumbs.length > 0 && (
          <div
            className="gf-strip"
            style={
              size?.mode === "side" && wide
                ? { width: size.thumbW, height: size.heroH, gap: GAP }
                : size?.mode === "row" && !wide
                  ? { height: size.strip, gap: GAP }
                  : { gap: GAP }
            }
          >
            {thumbs.map((img, n) => (
              <button className="gf-thumb" key={n} onClick={() => openAt(n + 1)} aria-label={`View photograph ${n + 2}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.alt}
                  width={img.w}
                  height={img.h}
                  onLoad={noteRatio(img.url)}
                />
                {n === thumbs.length - 1 && images.length > 4 && (
                  <span className="more-overlay">+{images.length - 4} more</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* No "view all" button: the "+N more" on the last thumbnail is the way in. */}

      {open && (
        <div className="lightbox" onClick={close}>
          <button className="lb-close" onClick={close} aria-label="Close">×</button>
          <button className="lb-nav lb-prev" aria-label="Previous"
            onClick={(e) => { e.stopPropagation(); prev(); }}>‹</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lb-img" src={images[i].url} alt={images[i].alt}
            onClick={(e) => e.stopPropagation()} />
          <button className="lb-nav lb-next" aria-label="Next"
            onClick={(e) => { e.stopPropagation(); next(); }}>›</button>
          <div className="lb-count">{i + 1} / {images.length}</div>
        </div>
      )}
    </>
  );
}
