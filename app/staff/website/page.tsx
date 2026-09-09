import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff-auth";
import { getSiteStats, analyticsConfigured } from "@/lib/web-analytics";
import { listApprovedContacts, listOptedOut } from "@/lib/portal-store";

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
 * There is deliberately no "time on site". Vercel Web Analytics does not
 * measure it, and a number nobody measured is worse than no number.
 */

function pct(now: number, before: number): { text: string; up: boolean } | null {
  if (!before) return null;
  const change = Math.round(((now - before) / before) * 100);
  return { text: `${change > 0 ? "+" : ""}${change}%`, up: change >= 0 };
}

/** "/properties/19-william-street-newport" reads better as its last part. */
function prettyPath(p: string): string {
  if (p === "/") return "Home";
  return p;
}

export default async function WebsitePage() {
  const staff = getStaff();
  if (!staff) redirect("/staff");

  const [stats, approved, optedOut] = await Promise.all([
    getSiteStats(30).catch(() => null),
    listApprovedContacts().catch(() => [] as number[]),
    listOptedOut().catch(() => [] as number[]),
  ]);

  const change = stats?.previous ? pct(stats.totals.visitors, stats.previous.visitors) : null;

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
          <>
            <p className="portal-intro">
              {stats.since} to {stats.until}.
              {stats.missing.length > 0 && ` Couldn't load ${stats.missing.join(", ")}.`}
            </p>

            <div className="wa-figures">
              <div>
                <div className="wa-n">{stats.totals.visitors.toLocaleString("en-AU")}</div>
                <div className="wa-l">
                  Visitors
                  {change && (
                    <span className={change.up ? "wa-up" : "wa-down"}> {change.text}</span>
                  )}
                </div>
              </div>
              <div>
                <div className="wa-n">{stats.totals.pageviews.toLocaleString("en-AU")}</div>
                <div className="wa-l">Page views</div>
              </div>
              <div>
                <div className="wa-n">{approved.length}</div>
                {/* Ours, not Vercel's — the off-market list, counted exactly. */}
                <div className="wa-l">
                  Off-market members
                  {optedOut.length > 0 && <span className="wa-sub"> · {optedOut.length} opted out of alerts</span>}
                </div>
              </div>
            </div>

            <div className="wa-cols">
              <div>
                <div className="times-label">Most looked at</div>
                {stats.topPages.length === 0 ? (
                  <p style={{ color: "var(--muted)" }}>Nothing recorded yet.</p>
                ) : (
                  <table className="wa-table">
                    <tbody>
                      {stats.topPages.map((p) => (
                        <tr key={p.name}>
                          <th scope="row">{prettyPath(p.name)}</th>
                          <td>{p.pageviews.toLocaleString("en-AU")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div>
                <div className="times-label">Found us via</div>
                {stats.referrers.length === 0 ? (
                  <p style={{ color: "var(--muted)" }}>Mostly direct, or nothing recorded yet.</p>
                ) : (
                  <table className="wa-table">
                    <tbody>
                      {stats.referrers.map((r) => (
                        <tr key={r.name}>
                          <th scope="row">{r.name}</th>
                          <td>{r.visitors.toLocaleString("en-AU")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {stats.funnel && (
              <>
                <div className="times-label" style={{ marginTop: 44 }}>Forms</div>
                <div className="wa-figures">
                  <div>
                    <div className="wa-n">{stats.funnel.started}</div>
                    <div className="wa-l">Started one</div>
                  </div>
                  <div>
                    <div className="wa-n">{stats.funnel.succeeded}</div>
                    <div className="wa-l">
                      Sent it
                      {stats.funnel.started > 0 && (
                        <span className="wa-sub">
                          {" "}· {Math.round((stats.funnel.succeeded / stats.funnel.started) * 100)}% finished
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    {/* The number that matters. A form failing is a lost lead
                        we would otherwise never hear about. */}
                    <div className={`wa-n${stats.funnel.failed > 0 ? " wa-bad" : ""}`}>{stats.funnel.failed}</div>
                    <div className="wa-l">Failed</div>
                  </div>
                </div>
              </>
            )}

            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 40 }}>
              Vercel Web Analytics doesn&rsquo;t measure time on site, so there isn&rsquo;t a figure
              for it here.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
