import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff-auth";
import { getMarketingSources } from "@/lib/boxdice";
import { listCampaigns } from "@/lib/campaigns";
import StartCampaign from "@/components/StartCampaign";

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
  const existing = new Map(campaigns.map((c) => [c.listingId, c]));

  return (
    <section className="portal-page">
      <div className="wrap" style={{ maxWidth: 760 }}>
        <Link href="/staff" className="backlink">← Vendor approvals</Link>
        <div className="eyebrow" style={{ marginTop: 18 }}>New approval</div>
        <h2>Which property?</h2>
        <p className="portal-intro">
          {showAll ? "Every listing with photos" : "Current listings"} from Box &amp; Dice. Photos, floorplan, copy and video come from the
          listing; board and brochure from its SharePoint folder. You review everything before
          anything is sent.
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
          <ul className="vc-pick">
            {sources.map((s) => {
              const c = existing.get(s.id);
              const ready = s.photos.length > 0 && s.copyText.length > 0;
              return (
                <li key={s.id}>
                  <div>
                    <div className="vc-addr">{s.address}</div>
                    <div className="vc-meta">
                      {s.photos.length} photo{s.photos.length === 1 ? "" : "s"}
                      {s.floorplans.length ? ` · ${s.floorplans.length} floorplan${s.floorplans.length === 1 ? "" : "s"}` : ""}
                      {s.copyText ? " · copy" : ""}
                      {s.videoUrl ? " · video" : ""}
                      {!ready && <span className="vc-warn"> · not loaded in the CRM yet</span>}
                    </div>
                    {c && (
                      <div className="vc-meta">
                        Already has an approval ({c.status}) —{" "}
                        <Link href={`/staff/${c.id}`}>open it</Link>
                      </div>
                    )}
                  </div>
                  <StartCampaign listingId={s.id} disabled={!ready} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
