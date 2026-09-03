/**
 * Force YouTube captions off.
 *
 * `cc_load_policy: 0` only means "don't turn captions ON by default" — it does
 * not override a viewer whose own YouTube account has captions switched on, or
 * a video with auto-generated captions. They then burn subtitles over the
 * middle of a property film, which is not the impression we're after.
 *
 * Unloading the captions module is the part that actually works. Both names
 * are tried: "captions" is the older AS3 module, "cc" the HTML5 one, and which
 * one a given player exposes depends on the embed. Neither is documented, so
 * every call is defensive — a failure here must never break playback.
 */
export function killCaptions(player: any): void {
  for (const mod of ["captions", "cc"]) {
    try {
      player?.unloadModule?.(mod);
    } catch {
      /* module not present on this player — fine */
    }
  }
  // Belt and braces: if the module reloads, leave it with no track selected.
  try {
    player?.setOption?.("captions", "track", {});
  } catch {
    /* ignore */
  }
}
