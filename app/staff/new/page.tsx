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
  /**
   * The most recent campaign per listing, APPROVED ONES INCLUDED.
   *
   * They used to be filtered out, which meant a property whose marketing had
   * been signed off three days earlier appeared here as untouched, offering a
   * Start button that would have created a second campaign for it. An approved
   * campaign is the most important thing this list can tell you about a
   * property, not the least.
   */
  const existing = new Map<number, (typeof campaigns)[number]>();
  for (const c of [...campaigns].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))) {
    existing.set(c.listingId, c);
  }

  return (
    <section className="portal-page">
      <div className="wrap col-form">
        <Link href="/staff/approvals" className="backlink">← Vendor approvals</Link>
        <div className="eyebrow">New approval</div>
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
                campaign: c
                  ? {
                      id: c.id,
                      status: c.status,
                      approvedAt: c.approvedAt,
                      approvedName: c.approvedName,
                    }
                  : null,
              };
            })}
          />
        )}
      </div>
    </section>
  );
}
