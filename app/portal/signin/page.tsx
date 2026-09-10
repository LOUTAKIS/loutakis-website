import PortalSignInForm from "@/components/PortalSignInForm";
import OffMarketCount from "@/components/OffMarketCount";

export const metadata = {
  title: "Sign in — Loutakis Real Estate",
  robots: { index: false, follow: false },
};

// Per request, not at build: the count under Request access has to be today's,
// and a figure baked in at deploy time would be a lie the moment a tag changed.
export const dynamic = "force-dynamic";

/**
 * Signing in to an account, not into one page.
 *
 * This used to be headed "Off-market", which framed the whole thing as a door
 * to a single list. It isn't: someone who registers has an account with us —
 * what they're looking for, the emails they get, the private list. The off-
 * market framing now sits where it belongs, next to Request access, which is
 * the only part of this page aimed at someone who isn't a member yet.
 */
export default function PortalSignInPage({
  searchParams,
}: {
  searchParams?: { expired?: string };
}) {
  return (
    <section className="portal-page">
      <div className="wrap" style={{ maxWidth: 560 }}>
        <div className="eyebrow">Your account</div>
        <h2>Sign in</h2>
        <p className="portal-intro">
          We&rsquo;ll email you a link — no password to remember.
        </p>
        <PortalSignInForm
          expired={searchParams?.expired === "1"}
          countSlot={<OffMarketCount className="portal-alt-count" />}
        />
      </div>
    </section>
  );
}
