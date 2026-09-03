import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStaff } from "@/lib/staff-auth";
import { getCampaign } from "@/lib/campaigns";
import { getMarketingSource } from "@/lib/boxdice";
import { listMediaSection } from "@/lib/sharepoint";
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

  const [source, board, brochure] = await Promise.all([
    getMarketingSource(campaign.listingId),
    campaign.folderPath ? listMediaSection(campaign.folderPath, "BOARD") : Promise.resolve([]),
    campaign.folderPath ? listMediaSection(campaign.folderPath, "BROCHURE") : Promise.resolve([]),
  ]);

  return (
    <section className="portal-page">
      <div className="wrap">
        <Link href="/staff" className="backlink">← Vendor approvals</Link>
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
