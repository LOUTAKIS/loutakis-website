import { redirect } from "next/navigation";
import { getViewer } from "@/lib/portal-session";
import { getOffMarketListings } from "@/lib/boxdice";
import type { Listing } from "@/lib/types";
import PortalEnquire from "@/components/PortalEnquire";

export const metadata = {
  title: "Off-market properties — Loutakis Real Estate",
  robots: { index: false, follow: false },
};

// Never cached: who can see this is decided per request, from the CRM.
export const dynamic = "force-dynamic";

/**
 * "19 William Street" → "William Street".
 *
 * The number is the one field that names the house. Without it a buyer still
 * knows the street, the suburb and what is on the block — enough to decide
 * whether to ask — while a neighbour reading over a shoulder cannot work out
 * which of their neighbours is selling. That is the deal we make with a vendor
 * who asks for a quiet campaign, and it costs the buyer nothing: they get the
 * address in the phone call that follows.
 *
 * Handles a unit prefix too ("12/34 Smith Street"), and leaves anything it
 * does not recognise alone rather than guessing a street name out of it.
 */
function streetOnly(street: string): string {
  const stripped = String(street ?? "")
    .trim()
    .replace(/^[\dA-Za-z]+\s*\/\s*/, "")
    .replace(/^\d+[A-Za-z]?(\s*-\s*\d+[A-Za-z]?)?\s+/, "")
    .trim();
  return stripped || String(street ?? "");
}


export default async function PortalPage() {
  const viewer = await getViewer();

  if (!viewer) redirect("/portal/signin");

  if (viewer.status !== "approved") {
    return (
      <section className="portal-page">
        <div className="wrap" style={{ maxWidth: 640 }}>
          <div className="eyebrow">Off-market</div>
          <h2>{viewer.status === "pending" ? "Still being reviewed" : "Access not active"}</h2>
          <p className="portal-intro">
            {viewer.status === "pending"
              ? "Michael reviews every request personally. You'll get an email the moment yours is approved."
              : "Your access to the off-market list isn't active. If you think that's a mistake, call 0409 438 025."}
          </p>
        </div>
      </section>
    );
  }

  // Never let a CRM hiccup take the page down. "Nothing available" and "we
  // couldn't reach the CRM" are different messages — saying the first when the
  // second is true would tell an approved buyer there's nothing for them.
  let listings: Listing[] = [];
  let unavailable = false;
  try {
    listings = await getOffMarketListings();
  } catch (err) {
    console.error("[portal] off-market list unavailable:", err);
    unavailable = true;
  }

  if (unavailable) {
    return (
      <section className="portal-page">
        <div className="wrap" style={{ maxWidth: 640 }}>
          <div className="eyebrow">Off-market</div>
          <h2>Just a moment</h2>
          <p className="portal-intro">
            We couldn&rsquo;t load the list right now. Please refresh in a minute — or call Michael
            on 0409 438 025 and he&rsquo;ll talk you through what&rsquo;s available.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="portal-page">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">Off-market</div>
            {/* Without a first name it becomes "Is it time to move?" — still a
                whole sentence, so the greeting is never left dangling. */}
            <h2>Is it time to move{viewer.firstName ? `, ${viewer.firstName}` : ""}?</h2>
          </div>
        </div>

        <p className="portal-intro">
          These aren&rsquo;t advertised anywhere else. Prices are by conversation — enquire on any
          property and we will call you.
        </p>

        {listings.length === 0 ? (
          <div className="portal-done">
            <h3>Nothing off-market right now</h3>
            <p>
              {/* The alert fires on anything NEW to the private list, not on a
                  match against buying criteria — so it must not promise a fit. */}
              When someone decides it&rsquo;s time to move, you&rsquo;ll be the first to know.
            </p>
          </div>
        ) : (
          /**
           * A LIST, NOTHING ELSE. No photographs, no descriptions, no street
           * numbers — and no house identifiable from the page.
           *
           * A vendor selling quietly has usually not agreed to their home
           * appearing on a screen at all. What is left is what a buyer needs to
           * decide whether to ask: the street, the suburb, the rooms and the
           * land. Everything past that happens in a phone call, which is how a
           * quiet campaign is supposed to work.
           */
          <div className="pl">
            <div className="pl-head" aria-hidden>
              <span>Street</span>
              <span>Suburb</span>
              <span className="pl-n">Bed</span>
              <span className="pl-n">Bath</span>
              <span className="pl-n">Car</span>
              <span>Land approx.</span>
              <span />
            </div>

            {listings.map((l) => (
              <div key={l.id} className="pl-row" id={l.slug}>
                <span className="pl-street">{streetOnly(l.address.street)}</span>
                <span className="pl-suburb">{l.address.suburb}</span>
                <span className="pl-n"><b className="pl-lbl">Bed </b>{l.bed}</span>
                <span className="pl-n"><b className="pl-lbl">Bath </b>{l.bath}</span>
                <span className="pl-n"><b className="pl-lbl">Car </b>{l.car}</span>
                {/* Never state a land size as fact: the measurement is
                    indicative, and the column heading says approx. */}
                <span className="pl-land">{l.landSize || "—"}</span>
                {/* Button in the last column, form underneath it across the
                    whole row. The office still receives the full street number
                    in the enquiry — it is only the page that omits it. */}
                <PortalEnquire
                  listingId={l.id}
                  listingAddress={`${l.address.street}, ${l.address.suburb}`}
                  agentNames={l.agents.map((a) => a.name)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
