import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getStaff } from "@/lib/staff-auth";
import { getContact, CATEGORY_APPROVED, CATEGORY_PENDING } from "@/lib/portal";
import { getRegisteredEmail, listOptedOut } from "@/lib/portal-store";
import { getActivity, type Activity } from "@/lib/portal-activity";
import MemberActions from "@/components/MemberActions";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * One member: what they asked for, and what they have actually done.
 *
 * The gap between those two is the point of this page. Someone who registered
 * saying "two bedrooms in Yarraville" and has since opened a four-bedroom in
 * Newport three times is telling you something their form never did — and it
 * is only knowable because they were signed in while they did it.
 *
 * Everything here is their own account activity. Nothing on this page comes
 * from anonymous browsing, and nothing could: a visitor who has not signed in
 * is not identified anywhere in this system.
 */

const KIND: Record<Activity["k"], string> = {
  signin: "Signed in",
  list: "Opened the private list",
  view: "Opened",
  enquiry: "Enquired about",
};

function when(t: number): string {
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  return new Date(t).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  });
}

/** "$800,000 – $900,000", "3+ beds" — criteria as a person would say them. */
function criteriaLines(c: any): string[] {
  const out: string[] = [];
  for (const cr of c?.criteria ?? []) {
    const bits: string[] = [];
    if (cr?.beds_from) bits.push(`${cr.beds_from}${cr.beds_to && cr.beds_to !== cr.beds_from ? `–${cr.beds_to}` : "+"} bed`);
    if (cr?.baths) bits.push(`${cr.baths}+ bath`);
    if (cr?.cars) bits.push(`${cr.cars}+ car`);
    const money = (n: unknown) => `$${Number(n).toLocaleString("en-AU")}`;
    if (cr?.price_from && cr?.price_to) bits.push(`${money(cr.price_from)} – ${money(cr.price_to)}`);
    else if (cr?.price_to) bits.push(`up to ${money(cr.price_to)}`);
    else if (cr?.price_from) bits.push(`from ${money(cr.price_from)}`);
    if (cr?.land_size_from) bits.push(`${cr.land_size_from}m²+ land`);
    if (cr?.notes) bits.push(String(cr.notes));
    if (bits.length) out.push(bits.join(" · "));
  }
  return out;
}

export default async function MemberPage({ params }: { params: { id: string } }) {
  const staff = getStaff();
  if (!staff) redirect("/staff");

  const contactId = params.id.replace(/\D/g, "");
  if (!contactId) notFound();

  let contact: any;
  try {
    contact = await getContact(contactId);
  } catch {
    notFound();
  }

  const [registered, optedOut, activity] = await Promise.all([
    getRegisteredEmail(contactId).catch(() => null),
    listOptedOut().catch(() => [] as number[]),
    getActivity(contactId),
  ]);

  const names = (contact?.categories ?? []).map((x: any) => String(x?.name ?? x));
  const status: "approved" | "pending" | "none" = names.includes(CATEGORY_APPROVED)
    ? "approved"
    : names.includes(CATEGORY_PENDING)
      ? "pending"
      : "none";

  const name = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ").trim() || `Contact ${contactId}`;
  const email = registered || String(contact?.email ?? "").trim();
  const mobile = String(contact?.mobile ?? "").trim();
  const criteria = criteriaLines(contact);
  /** The CRM's own timeline — enquiries and approvals are written here too. */
  const comments: any[] = Array.isArray(contact?.comments) ? contact.comments : [];

  return (
    <section className="portal-page">
      <div className="wrap">
        <Link href="/staff/members" className="backlink">← Members</Link>
        <div className="section-head">
          <div>
            <div className="eyebrow">
              {status === "approved" ? "Has access" : status === "pending" ? "Waiting on you" : "No access"}
            </div>
            <h2>{name}</h2>
          </div>
          <MemberActions contactId={Number(contactId)} status={status} name={name} />
        </div>

        <p className="portal-intro">
          {email ? <a href={`mailto:${email}`}>{email}</a> : "no email on file"}
          {mobile && (
            <>
              {" · "}
              <a href={`tel:${mobile.replace(/\s+/g, "")}`}>{mobile}</a>
            </>
          )}
          {optedOut.includes(Number(contactId)) && " · not receiving alert emails"}
        </p>

        <div className="wa-figures">
          <div>
            <div className="wa-n">{activity.lastSeen ? when(activity.lastSeen) : "Never"}</div>
            <div className="wa-l">Last seen</div>
          </div>
          <div>
            <div className="wa-n">{activity.signIns30d}</div>
            <div className="wa-l">Sign-ins · 30 days</div>
          </div>
          <div>
            <div className="wa-n">{activity.viewed.length}</div>
            <div className="wa-l">Properties opened</div>
          </div>
          <div>
            <div className="wa-n">{activity.enquiries.length}</div>
            <div className="wa-l">Enquiries</div>
          </div>
        </div>

        <div className="wa-cols">
          <div>
            <div className="times-label">What they asked for</div>
            {criteria.length === 0 ? (
              <p style={{ color: "var(--muted)", marginTop: 12 }}>
                No buying criteria on their CRM record.
              </p>
            ) : (
              <ul className="mb-plain">
                {criteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}

            {/* Beside the criteria on purpose: this is the comparison. */}
            <div className="times-label" style={{ marginTop: 34 }}>What they actually opened</div>
            {activity.viewed.length === 0 ? (
              <p style={{ color: "var(--muted)", marginTop: 12 }}>
                Nothing yet — or nothing since we started keeping this.
              </p>
            ) : (
              <ul className="mb-plain">
                {activity.viewed.map((v) => (
                  <li key={v.id}>
                    {v.address}
                    <span className="mb-muted">
                      {" · "}
                      {v.count} time{v.count === 1 ? "" : "s"}, last {when(v.last)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="times-label">Everything, newest first</div>
            {activity.events.length === 0 ? (
              <p style={{ color: "var(--muted)", marginTop: 12 }}>
                No activity recorded yet. This starts from the day it was switched on, not from
                when they registered.
              </p>
            ) : (
              <ul className="mb-plain">
                {activity.events.map((e, i) => (
                  <li key={i}>
                    {KIND[e.k]}
                    {e.a ? ` ${e.a}` : ""}
                    <span className="mb-muted"> · {when(e.t)}</span>
                  </li>
                ))}
              </ul>
            )}

            {comments.length > 0 && (
              <>
                <div className="times-label" style={{ marginTop: 34 }}>Notes in Box &amp; Dice</div>
                <ul className="mb-plain">
                  {comments.slice(0, 8).map((c: any, i: number) => (
                    <li key={i}>
                      {String(c?.text ?? "").slice(0, 200)}
                      {c?.created_at && (
                        <span className="mb-muted"> · {when(Date.parse(c.created_at))}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
