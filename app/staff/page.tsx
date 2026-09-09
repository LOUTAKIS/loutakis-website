import Link from "next/link";
import { getStaff } from "@/lib/staff-auth";
import { listCampaigns } from "@/lib/campaigns";
import StaffSignInForm from "@/components/StaffSignInForm";
import StaffSignOut from "@/components/StaffSignOut";
import RefreshListings from "@/components/RefreshListings";

export const metadata = {
  title: "Staff — Loutakis Real Estate",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * The staff dashboard — the one door into everything behind the sign-in.
 *
 * Vendor approvals used to BE this page, which worked while it was the only
 * tool. It isn't the last one we'll build, and a landing page that is really
 * one feature has to be dismantled the first time a second arrives. So the
 * approvals list moved to /staff/approvals and this became what it says: a
 * short list of what you can do, each with the one number that says whether it
 * needs you today.
 */
export default async function StaffPage({ searchParams }: { searchParams?: { expired?: string } }) {
  const staff = getStaff();

  if (!staff) {
    return (
      <section className="portal-page">
        <div className="wrap" style={{ maxWidth: 520 }}>
          <div className="eyebrow">Staff</div>
          <h2>Sign in</h2>
          <p className="portal-intro">
            Sign in with your Loutakis email to send and track vendor approvals.
          </p>
          <StaffSignInForm expired={searchParams?.expired === "1"} />
        </div>
      </section>
    );
  }

  /**
   * The count is the whole reason the tile is worth reading. A dashboard that
   * only names its tools tells you nothing you didn't know; "2 waiting on a
   * vendor" tells you whether to open it.
   *
   * A failure here must not take the dashboard down — the tile can lose its
   * subtitle and still be a working link to the page that will report the
   * error properly.
   */
  let waiting: number | null = null;
  try {
    const campaigns = await listCampaigns();
    waiting = campaigns.filter((c) => c.status !== "approved").length;
  } catch (err) {
    console.error("[staff] campaign counts unavailable", err);
  }

  return (
    <section className="portal-page">
      <div className="wrap">
        <div className="section-head">
          <div>
            {/* "Staff" was the sign-in page's label, and it said nothing once
                you were through it. */}
            <div className="eyebrow">Dashboard</div>
            <h2>{staff.name}</h2>
          </div>
          {/* Refresh belongs here, not on the approvals list. It doesn't
              refresh approvals — it re-reads the whole CRM for the whole site,
              which is a dashboard-level thing to do, and it is what you want
              right after editing a listing in Box & Dice with a vendor on the
              phone. */}
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <RefreshListings />
            <StaffSignOut />
          </div>
        </div>

        <div className="sd-grid">
          <Link href="/staff/approvals" className="sd-tile">
            <div className="sd-name">Vendor approvals</div>
            <p className="sd-desc">
              Send a vendor their marketing to sign off, and see who has opened it.
            </p>
            <div className="sd-count">
              {waiting === null
                ? "Open"
                : waiting === 0
                  ? "Nothing in flight"
                  : `${waiting} in flight`}
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
