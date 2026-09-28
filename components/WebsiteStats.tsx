"use client";

import Link from "next/link";
import { useState } from "react";
import type { SiteStats } from "@/lib/web-analytics";
import type { FormStats } from "@/lib/form-events";
import type { PropertyInsight, PropertySplit } from "@/lib/property-insights";
import type { MemberPulse } from "@/lib/member-pulse";
import { fmtDate } from "@/lib/when";

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

/**
 * A row of bars. No axis, no gridlines, no library.
 *
 * The question these answer is "what shape is this" — a launch, a quiet
 * fortnight, a cluster at nine at night. A precise reading is the table's job;
 * drawing axes here would add furniture to a picture whose whole point is to be
 * taken in at a glance. The exact number is in the title attribute for anyone
 * who wants it.
 */
function Bars({
  label,
  values,
  labelFor,
  titleFor,
}: {
  label: string;
  values: number[];
  labelFor: (i: number) => string;
  titleFor?: (i: number) => string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="bars-wrap">
      <div className="times-label">{label}</div>
      <div className="bars" style={{ ["--n" as any]: values.length }}>
        {values.map((v, i) => (
          <div key={i} className="bar" title={titleFor?.(i) ?? `${labelFor(i) || i}: ${v}`}>
            {/* A zero still draws a hairline: an empty column and a missing
                column look the same, and only one of them is true. */}
            <i style={{ height: `${v ? Math.max(4, (v / max) * 100) : 1}%` }} />
            <span>{labelFor(i)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PropertyRow({ r, people }: { r: PropertyInsight; people: boolean }) {
  return (
    <tr className={r.status === "current" ? undefined : "pi-past"}>
      <th scope="row">
        <Link href={`/properties/${r.slug}`}>{r.address}</Link>
        {r.status !== "current" && (
          <span className="wa-sub"> · {r.status.replace(/_/g, " ")}</span>
        )}
      </th>
      <td className={r.visitors === 0 ? "qs-empty" : undefined}>
        {(people ? r.visitors : r.pageviews).toLocaleString("en-AU")}
      </td>
      <td className={r.enquiries === 0 ? "qs-empty" : undefined}>{r.enquiries}</td>
    </tr>
  );
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
  forms,
  properties,
  pulse,
}: {
  stats: SiteStats;
  members: number;
  optedOut: number;
  forms: FormStats | null;
  properties: PropertySplit;
  pulse: MemberPulse | null;
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
          {fmtDate(stats.since)} to {fmtDate(stats.until)}.
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

      {/* ── What is on the market now ───────────────────────────────────
          Live listings only, zeros included: a property nobody has opened is
          the most useful row here. The sold archive is below, folded away —
          forty rows of a closed campaign is a table nobody reads. */}
      {properties.current.length > 0 && (
        <>
          <div className="times-label" style={{ marginTop: 44 }}>On the market</div>
          <div className="wa-scroll">
            <table className="wa-table pi-table">
              <thead>
                <tr>
                  <th scope="col">Property</th>
                  <th scope="col">{people ? "People" : "Views"}</th>
                  <th scope="col">Enquiries</th>
                </tr>
              </thead>
              <tbody>
                {properties.current.map((r) => (
                  <PropertyRow key={r.id} r={r} people={people} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="form-note">
            Views and enquiries answer different questions. Plenty of views and no enquiries is
            usually the price; no views at all is the marketing.
          </p>
        </>
      )}

      {properties.past.length > 0 && (
        <details className="pi-past-wrap">
          <summary>
            Sold and leased &middot; {properties.past.length} still getting looked at
          </summary>
          <div className="wa-scroll">
            <table className="wa-table pi-table">
              <tbody>
                {properties.past.map((r) => (
                  <PropertyRow key={r.id} r={r} people={people} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="form-note">
            Only the ones somebody opened in this window. A sold property with no views tells you
            nothing you didn&rsquo;t know.
          </p>
        </details>
      )}

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

      {/*
        Forms, counted by us.
        Never touched by the People/Views switch above: a form submission is a
        person by definition, and "views of a submission" is not a thing.
      */}
      <div className="times-label" style={{ marginTop: 44 }}>Forms</div>
      {!forms ? (
        <p style={{ color: "var(--muted)", marginTop: 12 }}>
          Couldn&rsquo;t read the form counts just now.
        </p>
      ) : !forms.any ? (
        <p style={{ color: "var(--muted)", marginTop: 12 }}>
          Nothing recorded yet. This starts from the day it was switched on — the first enquiry
          after that will appear here.
        </p>
      ) : (
        <>
          <div className="wa-figures">
            <div>
              <div className="wa-n">{forms.totals.started}</div>
              <div className="wa-l">Started one</div>
            </div>
            <div>
              <div className="wa-n">{forms.totals.sent}</div>
              <div className="wa-l">
                Sent it
                {forms.totals.started > 0 && (
                  <span className="wa-sub">
                    {" "}· {Math.round((forms.totals.sent / forms.totals.started) * 100)}% finished
                  </span>
                )}
              </div>
            </div>
            <div>
              {/* THE NUMBER THAT MATTERS. A form failing is a lead who typed
                  their name, saw an error and rang another agent. Nothing else
                  on this site would tell you it happened. */}
              <div className={`wa-n${forms.totals.failed > 0 ? " wa-bad" : ""}`}>
                {forms.totals.failed}
              </div>
              <div className="wa-l">Failed</div>
            </div>
          </div>

          {/* Which form, not just that one failed — the thing Vercel's version
              could never have told us. Only shown when there is a failure, so
              a clean month stays quiet. */}
          {forms.failing.length > 0 && (
            <table className="wa-table" style={{ marginTop: 26 }}>
              <tbody>
                {forms.failing.map((r) => (
                  <tr key={r.form}>
                    <th scope="row">{r.label}</th>
                    <td className="wa-bad">
                      {r.failed} failed{r.sent > 0 ? ` · ${r.sent} sent` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="wa-scroll">
            <table className="wa-table pi-table" style={{ marginTop: 26 }}>
              <thead>
                <tr>
                  <th scope="col">Form</th>
                  <th scope="col">Started</th>
                  <th scope="col">Sent</th>
                  <th scope="col">Finished</th>
                  <th scope="col">Typical time</th>
                </tr>
              </thead>
              <tbody>
                {forms.rows.map((r) => (
                  <tr key={r.form}>
                    <th scope="row">{r.label}</th>
                    <td>{r.started}</td>
                    <td>{r.sent}</td>
                    <td className={r.started && r.sent / r.started < 0.5 ? "wa-bad" : undefined}>
                      {r.started ? `${Math.round((r.sent / r.started) * 100)}%` : "—"}
                    </td>
                    <td>{r.medianSeconds ? mmss(r.medianSeconds) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Where they stop. The only figure here that says what to change. */}
          {forms.rows.some((r) => r.abandon.length > 0) && (
            <>
              <div className="times-label" style={{ marginTop: 34 }}>Where people give up</div>
              <div className="wa-cols">
                {forms.rows
                  .filter((r) => r.abandon.length > 0)
                  .map((r) => (
                    <div key={r.form}>
                      <div className="times-label">{r.label}</div>
                      <table className="wa-table">
                        <tbody>
                          {r.abandon.map((a) => (
                            <tr key={a.field}>
                              <th scope="row">{a.field}</th>
                              <td>{a.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
              </div>
              <p className="form-note">
                The last question they were on before leaving. Never what they typed in it.
              </p>
            </>
          )}

          {/* When they do it. */}
          {forms.hours && forms.dows && (
            <>
              <div className="times-label" style={{ marginTop: 34 }}>When they fill them in</div>
              <Bars
                label="By hour"
                values={forms.hours}
                labelFor={(i) => (i % 6 === 0 ? `${i}:00` : "")}
              />
              <Bars
                label="By day"
                values={forms.dows}
                labelFor={(i) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i]}
              />
              <p className="form-note">
                Melbourne time, every form since this started recording — a habit needs more than
                thirty days to show a shape.
              </p>
            </>
          )}
        </>
      )}

      {/* ── Who they are ─────────────────────────────────────────────── */}
      {(stats.devices.length > 0 || stats.countries.length > 0) && (
        <>
          <div className="times-label" style={{ marginTop: 44 }}>Who&rsquo;s looking</div>
          <div className="wa-cols">
            <Table label="On what" rows={stats.devices} unit={unit} empty="Nothing recorded yet." />
            <Table label="From where" rows={stats.countries} unit={unit} empty="Nothing recorded yet." />
          </div>
        </>
      )}

      {/* ── Members ──────────────────────────────────────────────────────
          Last, because it is the only section that asks something of you
          rather than telling you something. */}
      {pulse && pulse.total > 0 && (
        <>
          <div className="times-label" style={{ marginTop: 44 }}>Off-market members</div>
          {pulse.empty ? (
            <p style={{ color: "var(--muted)", marginTop: 12 }}>
              Nobody has signed in since this started recording. It only ever sees members who are
              signed in — public browsing isn&rsquo;t attributed to anyone.
            </p>
          ) : (
            <div className="wa-cols">
              <div>
                <div className="times-label">Active this week</div>
                {pulse.active.length === 0 ? (
                  <p style={{ color: "var(--muted)", marginTop: 12 }}>Nobody in the last seven days.</p>
                ) : (
                  <ul className="mb-plain">
                    {pulse.active.map((m) => (
                      <li key={m.contactId}>
                        <Link href={`/staff/members/${m.contactId}`}>{m.name}</Link>
                        <span className="mb-muted">
                          {" · "}
                          {m.viewed} propert{m.viewed === 1 ? "y" : "ies"} opened
                          {m.enquiries > 0 && `, ${m.enquiries} enquir${m.enquiries === 1 ? "y" : "ies"}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                {/* The list that is worth acting on. */}
                <div className="times-label">Gone quiet</div>
                {pulse.quiet.length === 0 ? (
                  <p style={{ color: "var(--muted)", marginTop: 12 }}>Nobody has gone cold.</p>
                ) : (
                  <ul className="mb-plain">
                    {pulse.quiet.map((m) => (
                      <li key={m.contactId}>
                        <Link href={`/staff/members/${m.contactId}`}>{m.name}</Link>
                        <span className="mb-muted">
                          {" · "}
                          {m.lastSeen ? `last in ${when(m.lastSeen)}` : "never signed in"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 44 }}>
        Vercel Web Analytics doesn&rsquo;t measure time on site or which page somebody left from, so
        there are no figures for those here.
      </p>
    </>
  );
}

/** "3 days ago", "6 weeks ago" — enough to know whether to ring. */
function when(t: number): string {
  const d = Math.round((Date.now() - t) / 86_400_000);
  if (d < 1) return "today";
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
}

/** "4m 20s" — a median, so seconds matter at the short end. */
function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}
