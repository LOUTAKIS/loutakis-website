import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStaff } from "@/lib/staff-auth";
import { getCampaign } from "@/lib/campaigns";
import { getMarketingSource } from "@/lib/boxdice";
import { listMediaSection } from "@/lib/sharepoint";
import { ensureCampaignFolder } from "@/lib/vendor-files";
import CampaignReview from "@/components/CampaignReview";

export const metadata = {
  title: "Review — Loutakis Real Estate",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: { id: string } }) {
  const staff = getStaff();
  if (!staff) redirect("/staff");

  const campaign = await getCampaign(params.id);
  if (!campaign) notFound();

  // Looks again if the folder wasn't there when the campaign was created —
  // which is the normal order of things, since Maree often makes the folder
  // after the listing goes on.
  const folder = await ensureCampaignFolder(campaign);
  const known = Boolean(folder.id || folder.path);

  const [source, board, brochure] = await Promise.all([
    getMarketingSource(campaign.listingId),
    known ? listMediaSection(folder, "BOARD") : Promise.resolve([]),
    known ? listMediaSection(folder, "BROCHURE") : Promise.resolve([]),
  ]);
  campaign.folderId = folder.id;
  campaign.folderPath = folder.path;

  return (
    <section className="portal-page">
      <div className="wrap">
        <Link href="/staff/approvals" className="backlink">← Vendor approvals</Link>
        <CampaignReview
          campaign={campaign}
          source={source}
          boardFiles={board.map(({ id, name, size, modified }) => ({ id, name, size, modified }))}
          brochureFiles={brochure.map(({ id, name, size, modified }) => ({ id, name, size, modified }))}
          staffEmail={staff.email}
        />
      </div>
    </section>
  );
}
