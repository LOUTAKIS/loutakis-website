import { redirect } from "next/navigation";
import { getViewer } from "@/lib/portal-session";
import { getOffMarketListings } from "@/lib/boxdice";
import type { Listing } from "@/lib/types";
import EnquiryForm from "@/components/EnquiryForm";
import { fmtInspection } from "@/lib/when";

export const metadata = {
  title: "Off-market properties — Loutakis Real Estate",
  robots: { index: false, follow: false },
};

// Never cached: who can see this is decided per request, from the CRM.
export const dynamic = "force-dynamic";


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
           * A LIST, NOT A GALLERY. No photographs anywhere on this page.
           *
           * A vendor selling quietly has usually not agreed to their house
           * appearing on a screen at all — the whole point of the private list
           * is that nothing is on display. Text also lets a buyer read six
           * properties in the time one hero image takes to load.
           *
           * Each row opens in place for the detail and the enquiry form, so
           * nobody has to leave the page or lose their place in it.
           */
          <div className="pl">
            <div className="pl-head" aria-hidden>
              <span>Suburb</span>
              <span>Address</span>
              <span className="pl-n">Bed</span>
              <span className="pl-n">Bath</span>
              <span className="pl-n">Car</span>
              <span>Land approx.</span>
              <span />
            </div>

            {listings.map((l) => (
              <details key={l.id} className="pl-row" id={l.slug}>
                <summary>
                  <span className="pl-suburb">{l.address.suburb}</span>
                  <span className="pl-street">{l.address.street}</span>
                  <span className="pl-n"><b className="pl-lbl">Bed </b>{l.bed}</span>
                  <span className="pl-n"><b className="pl-lbl">Bath </b>{l.bath}</span>
                  <span className="pl-n"><b className="pl-lbl">Car </b>{l.car}</span>
                  {/* Never state a land size as fact: the measurement is
                      indicative, and the column heading says approx. */}
                  <span className="pl-land">{l.landSize || "—"}</span>
                  <span className="pl-more">Details</span>
                </summary>

                <div className="pl-detail">
                  <div>
                    {l.headline && l.headline !== `${l.address.street}, ${l.address.suburb}` && (
                      <p className="portal-headline">{l.headline}</p>
                    )}

                    {l.description && (
                      <div className="portal-desc">
                        {l.description.split(/\n{2,}/).map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                      </div>
                    )}

                    {(l.inspections?.length ?? 0) > 0 && (
                      <div className="portal-times">
                        <div className="times-label">Private inspections</div>
                        <p style={{ color: "var(--muted)" }}>
                          {(l.inspections ?? []).map((i, n) => (
                            <span key={n}>{fmtInspection(i.start, i.end)}<br /></span>
                          ))}
                          or by appointment
                        </p>
                      </div>
                    )}
                  </div>

                  {/* The agent, by name and number only — no photograph here
                      either, so the page stays a list all the way down. */}
                  <aside className="agent">
                    {l.agents.map((a, i) => (
                      <div key={i} className={i > 0 ? "agent-extra" : undefined}>
                        <div className="nm">{a.name}</div>
                        <div className="ttl">{a.title ?? "Sales"}</div>
                        {(a.phone || a.email) && (
                          <div className="agent-contact">
                            {a.phone && <a href={`tel:${a.phone.replace(/\s+/g, "")}`}>{a.phone}</a>}
                            {a.email && <a href={`mailto:${a.email}`}>{a.email}</a>}
                          </div>
                        )}
                      </div>
                    ))}
                    <EnquiryForm
                      listingId={l.id}
                      listingAddress={`${l.address.street}, ${l.address.suburb}`}
                      agentNames={l.agents.map((a) => a.name)}
                    />
                  </aside>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
