import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.loutakis.com.au").replace(/\/$/, "");

/**
 * What crawlers may look at.
 *
 * Everything public is open. The disallowed paths are not secrets — they are
 * already behind sign-in or an unguessable signature — but they must stay out
 * of search results:
 *
 *   /staff, /api   the campaign dashboard and everything it calls
 *   /portal        the private off-market list; the whole promise to those
 *                  vendors is that their homes are NOT publicly listed, and an
 *                  indexed portal page would break that promise directly
 *   /approve       one-time vendor approval links, valid per campaign
 *
 * Sitemap is declared here so Google finds it without anyone submitting it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/staff", "/staff/", "/portal", "/portal/", "/approve/", "/api/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
