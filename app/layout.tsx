import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Loutakis Real Estate — Inner West",
  description:
    "Boutique real estate for Melbourne's Inner West. Current listings synced live from our CRM.",
  openGraph: {
    title: "Loutakis Real Estate — Inner West",
    description: "Boutique real estate for Melbourne's Inner West.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
