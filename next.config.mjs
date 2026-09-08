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
  },
  // A rate-limited fetch can legitimately wait 30s+ between retries. Next's
  // default 60s per-page limit restarts the page (and re-fetches), which is
  // exactly what makes the throttling worse.
  staticPageGenerationTimeout: 180,
  // The page was /services until Sep 2026. Anything already pointing there —
  // a bookmark, an email signature, a search result — lands on the new URL
  // rather than a 404.
  async redirects() {
    return [{ source: "/services", destination: "/sell-with-us", permanent: true }];
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
