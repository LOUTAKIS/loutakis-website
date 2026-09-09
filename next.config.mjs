/** @type {import('next').NextConfig} */
const nextConfig = {
  // One static-generation worker. Box & Dice rate-limits hard; with several
  // workers every property page fetches the same collections at the same
  // moment and the build degrades to mock data. Serial is a few seconds
  // slower and lets the first fetch feed the data cache for the rest.
  experimental: {
    cpus: 1,
    // Brochure panels are rendered on the server with pdf.js + a prebuilt Skia
    // canvas. Neither should be bundled by webpack: leave them as real Node
    // packages so the native binary is traced into the function.
    serverComponentsExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
    /**
     * Ship pdf.js's worker with the brochure route.
     *
     * pdf.mjs loads its worker through a dynamic import built from a string, so
     * Next's file tracer never sees the reference and leaves pdf.worker.mjs out
     * of the deployed function. The renderer arrives, its worker does not, and
     * every panel 502s with:
     *
     *   Setting up fake worker failed: "Cannot find module
     *   '/var/task/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'"
     *
     * Naming the file here is what puts it in the bundle. Verify after a build
     * with: grep pdf.worker .next/server/app/api/vendor/panel/**\/*.nft.json
     */
    outputFileTracingIncludes: {
      "/api/vendor/panel/**": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    },
  },
  // A rate-limited fetch can legitimately wait 30s+ between retries. Next's
  // default 60s per-page limit restarts the page (and re-fetches), which is
  // exactly what makes the throttling worse.
  staticPageGenerationTimeout: 180,
  /**
   * Old URLs that must never 404.
   *
   * These are not tidy-ups. Both addresses are printed on things already in the
   * world — signboards, brochures, QR codes, email signatures — and a printed
   * URL cannot be edited after the fact. They stay here permanently.
   *
   *   /listings   the Squarespace site's properties page, and where every QR
   *               code on a board or brochure currently points
   *   /services   renamed to /sell-with-us in Sep 2026
   *
   * `permanent: true` sends a 308, which browsers and search engines cache hard
   * — correct here, because these will never mean anything else.
   */
  async redirects() {
    return [
      { source: "/listings", destination: "/properties", permanent: true },
      // Deep links from the old site: the slugs don't survive the move, so send
      // them to the properties page rather than a 404. Someone scanning a board
      // wants to see what's for sale, not a specific dead URL.
      { source: "/listings/:path*", destination: "/properties", permanent: true },
      { source: "/services", destination: "/sell-with-us", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      // Box & Dice / CRM image CDN — add your real listing image host(s) here.
      { protocol: "https", hostname: "**.boxdice.com.au" },
      { protocol: "https", hostname: "**.amazonaws.com" },
      // Placeholder host used by the bundled mock data:
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
