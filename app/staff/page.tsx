import Link from "next/link";
import { getStaff } from "@/lib/staff-auth";
import { listCampaigns, type Campaign, type CampaignStatus } from "@/lib/campaigns";
import StaffSignInForm from "@/components/StaffSignInForm";
import StaffSignOut from "@/components/StaffSignOut";

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

/** "3 hours ago", "yesterday", "12 Aug". Enough to know whether to ring. */
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
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Melbourne" });
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

export default async function StaffPage({ searchParams }: { searchParams?: { expired?: string } }) {
  const staff = getStaff();

  if (!staff) {
    return (
      <section className="portal-page">
        <div className="wrap" style={{ maxWidth: 520 }}>
          <div className="eyebrow">Staff</div>
          <h2>Vendor approvals</h2>
          <p className="portal-intro">Sign in with your Loutakis email to send and track marketing approvals.</p>
          <StaffSignInForm expired={searchParams?.expired === "1"} />
        </div>
      </section>
    );
  }

  const campaigns = await listCampaigns();
  const live = campaigns.filter((c) => c.status !== "approved");
  const done = campaigns.filter((c) => c.status === "approved");

  return (
    <section className="portal-page">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">Staff · {staff.name}</div>
            <h2>Vendor approvals</h2>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Link href="/staff/new" className="btn">New approval</Link>
            <StaffSignOut />
          </div>
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
                  <li key={c.id}>
                    <Link href={`/staff/${c.id}`}>
                      <div className="vc-addr">{c.address}</div>
                      <div className="vc-meta">
                        {c.vendorName} · {c.vendorEmail}
                        {c.sentBy ? ` · sent by ${c.sentBy.split("@")[0]}` : ""}
                      </div>
                      <StatusLine c={c} />
                      {c.status === "changes" && c.amendments.at(-1) && (
                        <blockquote className="vc-quote">{c.amendments.at(-1)!.text}</blockquote>
                      )}
                    </Link>
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
