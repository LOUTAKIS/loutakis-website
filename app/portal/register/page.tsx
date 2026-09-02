import PortalRegisterForm from "@/components/PortalRegisterForm";

export const metadata = {
  title: "Off-market access — Loutakis Real Estate",
  description:
    "Request access to properties available for sale before they reach the market, across Melbourne's Inner West.",
  // The portal is private by design. Nothing here should be indexed, and no
  // listing content is rendered on this page at all.
  robots: { index: false, follow: false },
};

export default function PortalRegisterPage() {
  return (
    <section className="portal-page">
      <div className="wrap" style={{ maxWidth: 760 }}>
        <div className="eyebrow">Off-market</div>
        <h2>Properties before they hit the market</h2>

        <p className="portal-intro">
          Not every home we sell is advertised. Some vendors want a quiet campaign, some want to test
          the market before committing, and some are simply not ready for a board out the front. We
          keep a private list, and share it with buyers we know.
        </p>
        <p className="portal-intro">
          Access is granted individually — Michael reviews every request, so tell us enough to know
          what you&rsquo;re looking for.
        </p>

        <PortalRegisterForm />
      </div>
    </section>
  );
}
