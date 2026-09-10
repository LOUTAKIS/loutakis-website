"use client";

import Link from "next/link";
import { useState } from "react";
import type { SiteStats } from "@/lib/web-analytics";

/**
 * The website numbers, with ONE switch for the whole page.
 *
 * Every figure and both tables can be read two ways — how many people, or how
 * many times — and mixing the units silently is what made this page hard to
 * read in the first place. A switch per table only moved the problem: two
 * controls that look identical and govern different halves of a screen is a
 * puzzle, not an answer.
 *
 * So one control at the top, and everything below it obeys. Page views and
 * visitors stop being two separate figures and become the same figure asked a
 * different way, which is what they always were.
 *
 * Off-market members is the exception and always counts people, because it is
 * ours rather than Vercel's: a member is a person by definition and there is no
 * "views" of them.
 */
export type Unit = "people" | "views";

function pct(now: number, before: number): { text: string; up: boolean } | null {
  if (!before) return null;
  const change = Math.round(((now - before) / before) * 100);
  return { text: `${change > 0 ? "+" : ""}${change}%`, up: change >= 0 };
}

/** "/properties/19-william-street-newport" reads better with a name for home. */
function prettyPath(p: string): string {
  return p === "/" ? "Home" : p;
}

function Table({
  label,
  rows,
  unit,
  empty,
}: {
  label: string;
  rows: { name: string; visitors: number; pageviews: number }[];
  unit: Unit;
  empty: string;
}) {
  const value = (r: { visitors: number; pageviews: number }) =>
    unit === "people" ? r.visitors : r.pageviews;
  const sorted = [...rows].sort((a, b) => value(b) - value(a));

  return (
    <div>
      <div className="times-label">{label}</div>
      {sorted.length === 0 ? (
        <p style={{ color: "var(--muted)", marginTop: 12 }}>{empty}</p>
      ) : (
        <table className="wa-table">
          <tbody>
            {sorted.map((r) => (
              <tr key={r.name}>
                <th scope="row">{r.name}</th>
                <td>{value(r).toLocaleString("en-AU")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function WebsiteStats({
  stats,
  members,
  optedOut,
}: {
  stats: SiteStats;
  members: number;
  optedOut: number;
}) {
  const [unit, setUnit] = useState<Unit>("people");
  const people = unit === "people";

  const headline = people ? stats.totals.visitors : stats.totals.pageviews;
  const before = stats.previous ? (people ? stats.previous.visitors : stats.previous.pageviews) : null;
  const change = before === null ? null : pct(headline, before);

  const qr = stats.qrScans ? (people ? stats.qrScans.visitors : stats.qrScans.pageviews) : null;

  return (
    <>
      <div className="wa-bar">
        <p className="portal-intro" style={{ margin: 0 }}>
          {stats.since} to {stats.until}.
          {stats.missing.length > 0 && ` Couldn't load ${stats.missing.join(", ")}.`}
        </p>
        <div className="st-toggle" role="group" aria-label="Count people or page views">
          <button
            type="button"
            className={people ? "on" : undefined}
            onClick={() => setUnit("people")}
            aria-pressed={people}
          >
            People
          </button>
          <button
            type="button"
            className={!people ? "on" : undefined}
            onClick={() => setUnit("views")}
            aria-pressed={!people}
          >
            Views
          </button>
        </div>
      </div>

      <div className="wa-figures">
        <div>
          <div className="wa-n">{headline.toLocaleString("en-AU")}</div>
          <div className="wa-l">
            {people ? "Visitors" : "Page views"}
            {change && <span className={change.up ? "wa-up" : "wa-down"}> {change.text}</span>}
          </div>
        </div>

        {/* The printed boards and brochures point at /listings, which redirects
            to /properties. Nothing links there and nobody types it, so every
            request is a phone camera pointed at a board. */}
        {qr !== null && qr > 0 && (
          <div>
            <div className="wa-n">{qr.toLocaleString("en-AU")}</div>
            <div className="wa-l">QR scans</div>
          </div>
        )}

        <div>
          {/* Ours, not Vercel's, and always a count of people — so the switch
              above doesn't touch it. The only figure here you can act on, so
              it opens the list rather than just stating it. */}
          <Link href="/staff/members" className="wa-link">
            <div className="wa-n">{members}</div>
            <div className="wa-l">
              Off-market members
              {optedOut > 0 && <span className="wa-sub"> · {optedOut} opted out of alerts</span>}
            </div>
          </Link>
        </div>
      </div>

      <div className="wa-cols">
        <Table
          label="Most looked at"
          rows={stats.topPages.map((p) => ({ ...p, name: prettyPath(p.name) }))}
          unit={unit}
          empty="Nothing recorded yet."
        />
        <Table
          label="Found us via"
          rows={stats.referrers}
          unit={unit}
          empty="Mostly direct, or nothing recorded yet."
        />
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
              {/* The number that matters. A form failing is a lost lead we
                  would otherwise never hear about. */}
              <div className={`wa-n${stats.funnel.failed > 0 ? " wa-bad" : ""}`}>
                {stats.funnel.failed}
              </div>
              <div className="wa-l">Failed</div>
            </div>
          </div>
        </>
      )}

      <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 40 }}>
        Vercel Web Analytics doesn&rsquo;t measure time on site, so there isn&rsquo;t a figure for it
        here.
      </p>
    </>
  );
}
