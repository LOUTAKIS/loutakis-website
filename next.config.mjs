/** @type {import('next').NextConfig} */
const nextConfig = {
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
