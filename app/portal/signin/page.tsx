import PortalSignInForm from "@/components/PortalSignInForm";
import OffMarketCount from "@/components/OffMarketCount";

export const metadata = {
  title: "Sign in — Loutakis Real Estate",
  robots: { index: false, follow: false },
};

// Per request, not at build: the count has to be today's, and a figure baked
// in at deploy time would be a lie the moment a tag changed.
export const dynamic = "force-dynamic";

export default function PortalSignInPage({
  searchParams,
}: {
  searchParams?: { expired?: string };
}) {
  return (
    <section className="portal-page">
      <div className="wrap" style={{ maxWidth: 560 }}>
        <div className="eyebrow">Off-market</div>
        <h2>Sign in</h2>
        {/* The count first, then the mechanics. Someone hesitating at a wall
            needs to know what is behind it before they care how the door
            opens. */}
        <OffMarketCount className="portal-intro" />
        <p className="portal-intro">
          We&rsquo;ll email you a link — no password to remember.
        </p>
        <PortalSignInForm expired={searchParams?.expired === "1"} />
      </div>
    </section>
  );
}
