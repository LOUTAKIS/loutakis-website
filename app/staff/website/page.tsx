import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff-auth";
import { getSiteStats, analyticsConfigured } from "@/lib/web-analytics";
import { listApprovedContacts, listOptedOut } from "@/lib/portal-store";
import { getFormStats } from "@/lib/form-events";
import { propertyInsights } from "@/lib/property-insights";
import { memberPulse } from "@/lib/member-pulse";
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

  /**
   * Forms come from our own store, not from Vercel. Its custom events are a Pro
   * feature and never recorded a thing on this plan — see lib/form-events.ts.
   * They are fetched separately so a Vercel outage still leaves the one panel
   * that tells you a form is broken.
   */
  const [stats, approved, optedOut, forms, pulse] = await Promise.all([
    getSiteStats(30).catch(() => null),
    listApprovedContacts().catch(() => [] as number[]),
    listOptedOut().catch(() => [] as number[]),
    getFormStats(30).catch(() => null),
    /**
     * The only panel that names people rather than counting them, and the only
     * one that reads the CRM — so it is allowed to fail on its own without
     * taking the numbers down with it.
     */
    memberPulse().catch(() => null),
  ]);

  /**
   * Views come from Vercel and enquiries from our own store, so this can only
   * be built once both are back. Empty when either is missing, which the page
   * says rather than showing a table of zeros.
   */
  const properties =
    stats && forms
      ? await propertyInsights(stats.propertyPaths, forms.byListing).catch((err) => {
          console.error("[website] property insights failed", err);
          return { current: [], past: [] };
        })
      : { current: [], past: [] };

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
          <WebsiteStats
            stats={stats}
            members={approved.length}
            optedOut={optedOut.length}
            forms={forms}
            properties={properties}
            pulse={pulse}
          />
        )}
      </div>
    </section>
  );
}
