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
  // The live (unapproved) campaign per listing, if any.
  const existing = new Map(campaigns.filter((c) => c.status !== "approved").map((c) => [c.listingId, c]));

  return (
    <section className="portal-page">
      <div className="wrap" style={{ maxWidth: 760 }}>
        <Link href="/staff" className="backlink">← Vendor approvals</Link>
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
          <ul className="vc-pick">
            {sources.map((s) => {
              const c = existing.get(s.id);
              /**
               * A campaign can't start until the CRM holds the three things
               * every vendor page is built from. Board, brochure and video are
               * optional — they simply don't appear when they're absent.
               * Name what's missing: "not ready" tells nobody what to fix.
               */
              const missing = [
                s.photos.length === 0 ? "photos" : "",
                s.copyText.length === 0 ? "advertising copy" : "",
                s.floorplans.length === 0 ? "a floorplan" : "",
              ].filter(Boolean);
              const ready = missing.length === 0;
              return (
                <li key={s.id}>
                  <div>
                    <div className="vc-addr">{s.address}</div>
                    <div className="vc-meta">
                      {s.photos.length} photo{s.photos.length === 1 ? "" : "s"}
                      {s.floorplans.length ? ` · ${s.floorplans.length} floorplan${s.floorplans.length === 1 ? "" : "s"}` : ""}
                      {s.copyText ? " · copy" : ""}
                      {s.videoUrl ? " · video" : ""}
                    </div>
                    {!ready && (
                      <div className="vc-meta vc-warn">
                        Add {missing.length > 1 ? missing.slice(0, -1).join(", ") + " and " + missing[missing.length - 1] : missing[0]} in Box &amp; Dice, then reload this page.
                      </div>
                    )}
                    {c && c.status !== "approved" && (
                      <div className="vc-meta">Already in flight ({c.status === "draft" ? "not sent" : c.status}).</div>
                    )}
                  </div>
                  {c && c.status !== "approved" ? (
                    <Link href={`/staff/${c.id}`} className="btn">Open</Link>
                  ) : (
                    <StartCampaign listingId={s.id} disabled={!ready} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
