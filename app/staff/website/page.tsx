import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff-auth";
import { getSiteStats, analyticsConfigured } from "@/lib/web-analytics";
import { listApprovedContacts, listOptedOut } from "@/lib/portal-store";
import WebsiteStats from "@/components/WebsiteStats";

export const metadata = {
  title: "Website — Loutakis Real Estate",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Who is looking at the website, and what they do when they get there.
 *
 * Three questions, in the order they matter to an agent: is anyone coming,
 * what are they looking at, and did the site work when they tried to use it.
 * The last one is the only page on this site that would tell us a form has
 * started failing before a buyer does.
 *
 * The reading of it — people or page views — belongs to the browser, so
 * everything below the heading lives in one client component with a single
 * switch. This page only fetches.
 *
 * There is deliberately no "time on site". Vercel Web Analytics does not
 * measure it, and a number nobody measured is worse than no number.
 */
export default async function WebsitePage() {
  const staff = getStaff();
  if (!staff) redirect("/staff");

  const [stats, approved, optedOut] = await Promise.all([
    getSiteStats(30).catch(() => null),
    listApprovedContacts().catch(() => [] as number[]),
    listOptedOut().catch(() => [] as number[]),
  ]);

  return (
    <section className="portal-page">
      <div className="wrap">
        <Link href="/staff" className="backlink">← Dashboard</Link>
        <div className="section-head">
          <div>
            <div className="eyebrow">{staff.name}</div>
            <h2>Website</h2>
          </div>
        </div>

        {!analyticsConfigured() ? (
          <div className="portal-done" style={{ marginTop: 30 }}>
            <h3>Not connected yet</h3>
            <p>
              Add <code>VERCEL_PROJECT_ID</code> (and <code>VERCEL_API_TOKEN</code> if it is
              missing) to the project&rsquo;s environment variables and redeploy. Everything else is
              already in place.
            </p>
          </div>
        ) : !stats ? (
          <div className="portal-done" style={{ marginTop: 30 }}>
            <h3>Numbers unavailable</h3>
            <p>Vercel didn&rsquo;t answer. Try again shortly — nothing is lost, this is a read.</p>
          </div>
        ) : (
          <WebsiteStats stats={stats} members={approved.length} optedOut={optedOut.length} />
        )}
      </div>
    </section>
  );
}
