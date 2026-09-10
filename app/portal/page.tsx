import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/portal-session";
import { getOffMarketCount } from "@/lib/boxdice";
import { getContact } from "@/lib/portal";
import { listOptedOut } from "@/lib/portal-store";
import PortalSignOut from "@/components/PortalSignOut";

export const metadata = {
  title: "Your account — Loutakis Real Estate",
  robots: { index: false, follow: false },
};

// Never cached: who can see this is decided per request, from the CRM.
export const dynamic = "force-dynamic";

/**
 * A buyer's account.
 *
 * Signing in used to drop someone straight onto the off-market list, which
 * made the whole thing look like one page behind a password rather than an
 * account they have with us. It isn't: they registered, they told us what they
 * are looking for, they get emails, and the private list is one of the things
 * that comes with it. This is the room; the list is a door out of it.
 *
 * It also gives everything after this somewhere to go — saved searches, their
 * own enquiries, alert settings — without another sign-in wall being invented
 * each time.
 */

/** "3+ bed · $800,000 – $900,000" — their criteria as a person would say them. */
function criteriaLines(contact: any): string[] {
  const out: string[] = [];
  for (const cr of contact?.criteria ?? []) {
    const bits: string[] = [];
    if (cr?.beds_from) {
      bits.push(
        `${cr.beds_from}${cr.beds_to && cr.beds_to !== cr.beds_from ? `–${cr.beds_to}` : "+"} bed`
      );
    }
    if (cr?.baths) bits.push(`${cr.baths}+ bath`);
    if (cr?.cars) bits.push(`${cr.cars}+ car`);
    const money = (n: unknown) => `$${Number(n).toLocaleString("en-AU")}`;
    if (cr?.price_from && cr?.price_to) bits.push(`${money(cr.price_from)} – ${money(cr.price_to)}`);
    else if (cr?.price_to) bits.push(`up to ${money(cr.price_to)}`);
    else if (cr?.price_from) bits.push(`from ${money(cr.price_from)}`);
    if (bits.length) out.push(bits.join(" · "));
  }
  return out;
}

export default async function PortalHomePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/portal/signin");

  if (viewer.status !== "approved") {
    return (
      <section className="portal-page">
        <div className="wrap" style={{ maxWidth: 640 }}>
          <div className="eyebrow">Your account</div>
          <h2>{viewer.status === "pending" ? "Still being reviewed" : "Access not active"}</h2>
          <p className="portal-intro">
            {viewer.status === "pending"
              ? "We're reviewing your request. You'll get an email the moment it's approved."
              : "Your access to the off-market list isn't active. If you think that's a mistake, call us."}
          </p>
          <PortalSignOut />
        </div>
      </section>
    );
  }

  /**
   * Both reads are allowed to fail on their own. A count that didn't load
   * should cost the tile its number, not the page.
   */
  const [count, contact, optedOut] = await Promise.all([
    getOffMarketCount().catch(() => null),
    getContact(viewer.contactId).catch(() => null),
    listOptedOut().catch(() => [] as number[]),
  ]);

  const criteria = criteriaLines(contact);
  const alertsOff = optedOut.includes(Number(viewer.contactId));

  return (
    <section className="portal-page">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">Your account</div>
            {/* Without a first name it becomes "Is it time to move?" — still a
                whole sentence, so the greeting is never left dangling. */}
            <h2>Is it time to move{viewer.firstName ? `, ${viewer.firstName}` : ""}?</h2>
          </div>
          <PortalSignOut />
        </div>

        <div className="sd-grid" style={{ marginTop: 34 }}>
          <Link href="/portal/off-market" className="sd-tile">
            <div className="sd-name">Off-market properties</div>
            <p className="sd-desc">
              Homes we&rsquo;re selling quietly — not advertised here or anywhere else.
            </p>
            <div className="sd-count">
              {count === null ? "Open the list" : count === 0 ? "Nothing right now" : `${count} available`}
            </div>
          </Link>
        </div>

        <div className="wa-cols" style={{ marginTop: 48 }}>
          <div>
            <div className="times-label">What we&rsquo;re looking out for</div>
            {criteria.length === 0 ? (
              <p style={{ color: "var(--muted)", marginTop: 12 }}>
                Nothing recorded yet. <a href="tel:0409438025">Call us</a> and we&rsquo;ll set it
                up.
              </p>
            ) : (
              <ul className="mb-plain">
                {criteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}
            <p className="form-note">
              To change any of this, <a href="tel:0409438025">call us</a> — it&rsquo;s faster than a
              form and we&rsquo;ll know what you mean.
            </p>
          </div>

          <div>
            <div className="times-label">Alerts</div>
            <p style={{ color: "var(--muted)", marginTop: 12 }}>
              {alertsOff
                ? "You've asked us not to email you about new off-market properties. Sign in here whenever you want to look."
                : "We'll email you when something new goes on the private list."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
