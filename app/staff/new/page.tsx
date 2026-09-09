import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff-auth";
import { getMarketingSources } from "@/lib/boxdice";
import { listCampaigns } from "@/lib/campaigns";
import CampaignPicker from "@/components/CampaignPicker";

export const metadata = {
  title: "New approval — Loutakis Real Estate",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function NewApprovalPage({ searchParams }: { searchParams?: { all?: string } }) {
  const staff = getStaff();
  if (!staff) redirect("/staff");

  const showAll = searchParams?.all === "1";
  const [sources, campaigns] = await Promise.all([getMarketingSources(showAll), listCampaigns()]);
  // The live (unapproved) campaign per listing, if any.
  const existing = new Map(campaigns.filter((c) => c.status !== "approved").map((c) => [c.listingId, c]));

  return (
    <section className="portal-page">
      <div className="wrap" style={{ maxWidth: 760 }}>
        <Link href="/staff/approvals" className="backlink">← Vendor approvals</Link>
        <div className="eyebrow" style={{ marginTop: 18 }}>New approval</div>
        <h2>Which property?</h2>
        <p className="portal-intro">
          {showAll ? "Every listing with photos" : "Current listings"} from Box &amp; Dice. Photos,
          floorplan, copy and video come from the listing; board and brochure from its SharePoint
          folder. A campaign needs photos, copy and a floorplan before it can start. You review
          everything before anything is sent.
        </p>
        <p className="form-note">
          {showAll ? (
            <Link href="/staff/new">Show current listings only</Link>
          ) : (
            <Link href="/staff/new?all=1">Show all listings, including sold</Link>
          )}
        </p>

        {sources.length === 0 ? (
          <div className="portal-done">
            <h3>No current listings</h3>
            <p>Nothing in Box &amp; Dice has status “current” right now.</p>
          </div>
        ) : (
          <CampaignPicker
            items={sources.map((s) => {
              const c = existing.get(s.id);
              return {
                id: s.id,
                address: s.address,
                suburb: s.suburb,
                photos: s.photos.length,
                floorplans: s.floorplans.length,
                hasCopy: s.copyText.length > 0,
                hasVideo: Boolean(s.videoUrl),
                campaign: c ? { id: c.id, status: c.status } : null,
              };
            })}
          />
        )}
      </div>
    </section>
  );
}
