import { redirect } from "next/navigation";
import { getViewer } from "@/lib/portal-session";
import { getOffMarketListings } from "@/lib/boxdice";
import EnquiryForm from "@/components/EnquiryForm";

export const metadata = {
  title: "Off-market properties — Loutakis Real Estate",
  robots: { index: false, follow: false },
};

// Never cached: who can see this is decided per request, from the CRM.
export const dynamic = "force-dynamic";

const fmt = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(+d)) return "";
  return d.toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  });
};

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

  const listings = await getOffMarketListings();

  return (
    <section className="portal-page">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">Off-market</div>
            <h2>Available now{viewer.firstName ? `, ${viewer.firstName}` : ""}</h2>
          </div>
        </div>

        <p className="portal-intro">
          These aren&rsquo;t advertised anywhere else. Prices are by conversation — enquire on any
          property and the agent will call you.
        </p>

        {listings.length === 0 ? (
          <div className="portal-done">
            <h3>Nothing off-market right now</h3>
            <p>
              We&rsquo;ll email you when something comes up that fits what you&rsquo;re looking for.
            </p>
          </div>
        ) : (
          <div className="portal-list">
            {listings.map((l) => (
              <article key={l.id} className="portal-listing" id={l.slug}>
                {l.images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="portal-hero" src={l.images[0].url} alt={l.images[0].alt} />
                )}

                <div className="portal-body">
                  <div className="portal-main">
                    <h3>
                      {l.address.street}, {l.address.suburb}
                    </h3>
                    {l.headline && l.headline !== `${l.address.street}, ${l.address.suburb}` && (
                      <p className="portal-headline">{l.headline}</p>
                    )}

                    <div className="feat">
                      <div><span className="n">{l.bed}</span>Beds</div>
                      <div><span className="n">{l.bath}</span>Baths</div>
                      <div><span className="n">{l.car}</span>Cars</div>
                      {l.landSize && <div><span className="n">{l.landSize}</span>Land</div>}
                    </div>

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
                            <span key={n}>{fmt(i.start)}<br /></span>
                          ))}
                          or by appointment
                        </p>
                      </div>
                    )}

                    {l.images.length > 1 && (
                      <div className="portal-gallery">
                        {l.images.slice(1, 7).map((img, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={img.url} alt={img.alt} loading="lazy" />
                        ))}
                      </div>
                    )}
                  </div>

                  <aside className="agent">
                    {l.agents.map((a, i) => (
                      <div key={i} className={i > 0 ? "agent-extra" : undefined}>
                        {a.photo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="agent-photo" src={a.photo} alt={a.name} />
                        )}
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
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
