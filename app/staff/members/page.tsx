import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff-auth";
import { listMembers, type Member } from "@/lib/portal-members";
import MemberActions from "@/components/MemberActions";

export const metadata = {
  title: "Off-market members — Loutakis Real Estate",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Who is on the private list, and the two decisions you can make about them.
 *
 * Until now the only way to approve someone was the one-tap link in the
 * notification email — which works, and stays — but if that email was missed
 * there was no way back to the request, and no way at all to see the list as a
 * whole or take someone off it.
 *
 * Waiting first, because they are the ones who need something from you.
 */

const LABEL: Record<Member["status"], string> = {
  pending: "Waiting on you",
  approved: "Has access",
  none: "No access",
};

export default async function MembersPage() {
  const staff = getStaff();
  if (!staff) redirect("/staff");

  let members: Member[] = [];
  let failed = false;
  try {
    members = await listMembers();
  } catch (err) {
    console.error("[members] list failed", err);
    failed = true;
  }

  const waiting = members.filter((m) => m.status === "pending");
  const approved = members.filter((m) => m.status === "approved");

  return (
    <section className="portal-page">
      <div className="wrap">
        <Link href="/staff" className="backlink">← Dashboard</Link>
        <div className="section-head">
          <div>
            <div className="eyebrow">{staff.name}</div>
            <h2>Off-market members</h2>
          </div>
        </div>

        {failed ? (
          <div className="portal-done" style={{ marginTop: 30 }}>
            <h3>Couldn&rsquo;t read the list</h3>
            <p>Box &amp; Dice didn&rsquo;t answer. Try again shortly — nothing is lost, this is a read.</p>
          </div>
        ) : members.length === 0 ? (
          <div className="portal-done" style={{ marginTop: 30 }}>
            <h3>Nobody has registered yet</h3>
            <p>
              Registrations from the website appear here. The Request access link is on the sign-in
              page and on the Properties page.
            </p>
          </div>
        ) : (
          <>
            <p className="portal-intro">
              {approved.length} with access
              {waiting.length > 0 && `, ${waiting.length} waiting on a decision`}.
              {" "}Access is granted by the Box &amp; Dice category, so removing it here locks them
              out on their next click.
            </p>

            <div className="mb-list">
              {members.map((m) => (
                <div key={m.contactId} className={`mb-row mb-${m.status}`}>
                  <div>
                    {/* The name opens them: criteria, what they have opened,
                        and every sign-in since. */}
                    <Link href={`/staff/members/${m.contactId}`} className="mb-name">
                      {m.name}
                    </Link>
                    <div className="mb-contact">
                      {m.email ? <a href={`mailto:${m.email}`}>{m.email}</a> : "no email on file"}
                      {m.mobile && (
                        <>
                          {" · "}
                          <a href={`tel:${m.mobile.replace(/\s+/g, "")}`}>{m.mobile}</a>
                        </>
                      )}
                      {/* Opting out stops the new-listing emails only — it does
                          not affect access, and the two get confused. */}
                      {m.optedOut && <span className="mb-flag"> · no alert emails</span>}
                    </div>
                  </div>

                  <div className="mb-right">
                    <span className="mb-status">{LABEL[m.status]}</span>
                    <MemberActions contactId={m.contactId} status={m.status} name={m.name} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
