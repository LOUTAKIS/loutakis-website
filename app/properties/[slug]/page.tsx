import Link from "next/link";
import { notFound } from "next/navigation";
import { getListings, getListingBySlug } from "@/lib/boxdice";
import { STATUS_LABEL } from "@/lib/types";
import EnquiryForm from "@/components/EnquiryForm";
import Gallery from "@/components/Gallery";

export const revalidate = 600;

export async function generateStaticParams() {
  const listings = await getListings();
  return listings.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const l = await getListingBySlug(params.slug);
  if (!l) return { title: "Property not found" };
  return {
    title: `${l.address.street}, ${l.address.suburb} — Loutakis Real Estate`,
    description: l.headline,
    openGraph: { images: l.images[0]?.url ? [l.images[0].url] : [] },
  };
}

function fmtInspection(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit",
  });
}

export default async function PropertyPage({ params }: { params: { slug: string } }) {
  const l = await getListingBySlug(params.slug);
  if (!l) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: `${l.address.street}, ${l.address.suburb}`,
    description: l.description,
    image: l.images.map((i) => i.url),
    url: `/properties/${l.slug}`,
  };

  return (
    <section style={{ paddingTop: 40 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="wrap">
        <Link href="/properties" className="backlink">← All properties</Link>

        <div style={{ marginTop: 18 }}>
          <Gallery images={l.images} />
        </div>

        <div className="detail-grid">
          <div>
            <div className="eyebrow">{STATUS_LABEL[l.status]}</div>
            <h1 style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: "clamp(28px,4vw,40px)" }}>
              {l.address.street}, {l.address.suburb}
            </h1>
            <div className="price-row">
              <div>
                <div className="price-big">{l.priceDisplay}</div>
                {l.soiUrl && (
                  <a href={l.soiUrl} target="_blank" rel="noopener noreferrer" className="btn"
                    style={{ marginTop: 16, fontSize: 9, padding: "10px 21px", letterSpacing: ".15em" }}>
                    Statement of Information
                  </a>
                )}
              </div>
              <div>
                {l.auctionAt && (
                  <div style={{ marginBottom: 18 }}>
                    <div className="times-label">Auction</div>
                    <p>{fmtInspection(l.auctionAt)}</p>
                  </div>
                )}
                {l.inspections && l.inspections.length > 0 && (
                  <div>
                    <div className="times-label">Inspections</div>
                    <p style={{ color: "var(--muted)" }}>
                      {l.inspections.map((insp, i) => <span key={i}>{fmtInspection(insp.start)}<br /></span>)}
                      or by private appointment
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="feat">
              <div><span className="n">{l.bed}</span><span className="l">Beds</span></div>
              <div><span className="n">{l.bath}</span><span className="l">Baths</span></div>
              <div><span className="n">{l.car}</span><span className="l">Cars</span></div>
              {l.landSize && <div><span className="n">{l.landSize}</span><span className="l">Land</span></div>}
            </div>

            <p style={{ color: "var(--muted)" }}>{l.description}</p>

            {l.features.length > 0 && (
              <>
                <h3 style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: 20, margin: "30px 0 6px" }}>Features</h3>
                <ul className="features-list">
                  {l.features.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </>
            )}

            {l.documents && l.documents.length > 0 && (
              <>
                <h3 style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: 20, margin: "30px 0 10px" }}>Documents</h3>
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {l.documents.map((d, i) => (
                    <li key={i} style={{ borderTop: "1px solid var(--line)", padding: "12px 0" }}>
                      <a href={d.url} target="_blank" rel="noopener noreferrer"
                         style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
                        <span>{d.name}</span>
                        <span style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted)" }}>View / download</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <aside>
            <div className="agent">
              {l.agents[0]?.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="agent-photo" src={l.agents[0].photo} alt={l.agents[0].name} />
              )}
              <div className="nm">{l.agents[0]?.name ?? "Loutakis Real Estate"}</div>
              <div className="ttl">{l.agents[0]?.title ?? "Sales"}</div>
              {(l.agents[0]?.phone || l.agents[0]?.email) && (
                <div className="agent-contact">
                  {l.agents[0]?.phone && (
                    <a href={`tel:${l.agents[0].phone.replace(/\s+/g, "")}`}>{l.agents[0].phone}</a>
                  )}
                  {l.agents[0]?.email && (
                    <a href={`mailto:${l.agents[0].email}`}>{l.agents[0].email}</a>
                  )}
                </div>
              )}
              <EnquiryForm listingId={l.id} />
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
