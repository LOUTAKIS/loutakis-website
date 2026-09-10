import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff-auth";
import { listCampaigns, type Campaign, type CampaignStatus, campaignVendors } from "@/lib/campaigns";
import { fmtDate } from "@/lib/when";
import DeleteCampaign from "@/components/DeleteCampaign";

export const metadata = {
  title: "Vendor approvals — Loutakis Real Estate",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  opened: "Opened",
  approved: "Approved",
  changes: "Changes requested",
};

/** "3 hours ago", "yesterday", "12-08-2026". Enough to know whether to ring. */
function ago(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - +new Date(iso);
  const m = Math.round(ms / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  return fmtDate(iso);
}

function StatusLine({ c }: { c: Campaign }) {
  switch (c.status) {
    case "draft":
      return <span className="vc-status draft">Not sent</span>;
    case "sent":
      return <span className="vc-status sent">Sent {ago(c.sentAt)} · not opened yet</span>;
    case "opened":
      return <span className="vc-status opened">Opened {ago(c.openedAt)}{c.openCount > 1 ? ` · ${c.openCount} times` : ""}</span>;
    case "approved":
      return <span className="vc-status approved">Approved {ago(c.approvedAt)} by {c.approvedName}</span>;
    case "changes":
      return <span className="vc-status changes">Changes requested {ago(c.amendments.at(-1)?.at ?? null)}</span>;
  }
}

export default async function ApprovalsPage() {
  // Sign-in lives on the dashboard, so there is one door into staff, not two.
  const staff = getStaff();
  if (!staff) redirect("/staff");

  const campaigns = await listCampaigns();
  const live = campaigns.filter((c) => c.status !== "approved");
  const done = campaigns.filter((c) => c.status === "approved");

  return (
    <section className="portal-page">
      <div className="wrap">
        <Link href="/staff" className="backlink">← Dashboard</Link>
        <div className="section-head">
          <div>
            {/* Just the name: the line above already says where you are, and
                "Staff · Daldy" under "← Staff" was the same word twice. */}
            <div className="eyebrow">{staff.name}</div>
            <h2>Vendor approvals</h2>
          </div>
          <Link href="/staff/new" className="btn">New approval</Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="portal-done" style={{ marginTop: 40 }}>
            <h3>Nothing in flight</h3>
            <p>Start one with New approval — pick the property, review what’s been gathered, send the vendor a link.</p>
          </div>
        ) : (
          <>
            {live.length > 0 && (
              <ul className="vc-list">
                {live.map((c) => (
                  <li key={c.id} className="vc-row">
                    <Link href={`/staff/${c.id}`}>
                      <div className="vc-addr">{c.address}</div>
                      {(campaignVendors(c).length > 0 || c.sentBy) && (
                        <div className="vc-meta">
                          {[
                            campaignVendors(c).map((v) => v.name || v.email).filter(Boolean).join(" & "),
                            c.sentBy ? `sent by ${c.sentBy.split("@")[0]}` : "",
                          ].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      <StatusLine c={c} />
                      {c.status === "changes" && c.amendments.at(-1) && (
                        <blockquote className="vc-quote">{c.amendments.at(-1)!.text}</blockquote>
                      )}
                    </Link>
                    <DeleteCampaign id={c.id} address={c.address} />
                  </li>
                ))}
              </ul>
            )}
            {done.length > 0 && (
              <>
                <div className="eyebrow" style={{ marginTop: 48 }}>Approved</div>
                <ul className="vc-list done">
                  {done.map((c) => (
                    <li key={c.id}>
                      <Link href={`/staff/${c.id}`}>
                        <div className="vc-addr">{c.address}</div>
                        <StatusLine c={c} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
