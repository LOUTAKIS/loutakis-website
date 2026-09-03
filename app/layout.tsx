import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SiteChrome from "@/components/SiteChrome";

// Set NEXT_PUBLIC_SITE_URL in Vercel to https://www.loutakis.com.au on launch
// day and every absolute URL below follows automatically.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://loutakis-website.vercel.app";

export const metadata: Metadata = {
  // Open Graph ignores relative image paths; metadataBase makes them absolute.
  metadataBase: new URL(siteUrl),
  title: "Loutakis Real Estate",
  description:
    "Boutique real estate for Melbourne's Inner West. Current listings synced live from our CRM.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Loutakis Real Estate",
    title: "Loutakis Real Estate",
    description: "Boutique real estate for Melbourne's Inner West.",
    locale: "en_AU",
    images: [
      {
        url: "/brand/hero.jpg",
        alt: "Loutakis Real Estate — Melbourne's Inner West",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Loutakis Real Estate",
    description: "Boutique real estate for Melbourne's Inner West.",
    images: ["/brand/hero.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteChrome header={<SiteHeader />} footer={<SiteFooter />}>
          {children}
        </SiteChrome>
      </body>
    </html>
  );
}
