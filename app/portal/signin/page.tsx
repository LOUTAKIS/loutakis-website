import PortalSignInForm from "@/components/PortalSignInForm";

export const metadata = {
  title: "Sign in — Loutakis Real Estate",
  robots: { index: false, follow: false },
};

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
        <p className="portal-intro">
          We&rsquo;ll email you a link — no password to remember.
        </p>
        <PortalSignInForm expired={searchParams?.expired === "1"} />
      </div>
    </section>
  );
}
