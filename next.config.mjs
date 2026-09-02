/** @type {import('next').NextConfig} */
const nextConfig = {
  // One static-generation worker. Box & Dice rate-limits hard; with several
  // workers every property page fetches the same collections at the same
  // moment and the build degrades to mock data. Serial is a few seconds
  // slower and lets the first fetch feed the data cache for the rest.
  experimental: { cpus: 1 },
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
