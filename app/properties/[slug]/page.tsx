import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getListings, getListingBySlug } from "@/lib/boxdice";
import { STATUS_LABEL } from "@/lib/types";
import EnquiryForm from "@/components/EnquiryForm";

export const revalidate = 600;

export async function generateStaticParams() {
  const listings = await getListings();
  return listings.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const l = await getListingBySlug(params.slug);
  if (!l) return { title: "Property not found" };
  return {
    title: `${l.address.street}, ${l.address.suburb} — Harbourview`,
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

        <div className="detail-hero" style={{ marginTop: 18 }}>
          {l.images[0] && (
            <Image src={l.images[0].url} alt={l.images[0].alt} fill priority style={{ objectFit: "cover" }} />
          )}
        </div>
        {l.images.length > 1 && (
          <div className="gallery-strip">
            {l.images.slice(1, 4).map((img, i) => (
              <div className="g" key={i}>
                <Image src={img.url} alt={img.alt} fill style={{ objectFit: "cover" }} />
              </div>
            ))}
          </div>
        )}

        <div className="detail-grid">
          <div>
            <div className="eyebrow">{STATUS_LABEL[l.status]}</div>
            <h1 style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: "clamp(28px,4vw,40px)" }}>
              {l.address.street}, {l.address.suburb}
            </h1>
            <div style={{ fontFamily: "var(--serif)", fontSize: 24, marginTop: 8 }}>{l.priceDisplay}</div>

            {l.soiUrl && (
              <a href={l.soiUrl} target="_blank" rel="noopener noreferrer" className="btn" style={{ marginTop: 18 }}>
                Statement of Information &darr;
              </a>
            )}

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

            {l.inspections && l.inspections.length > 0 && (
              <>
                <h3 style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: 20, margin: "30px 0 6px" }}>Inspections</h3>
                <p style={{ color: "var(--muted)" }}>
                  {l.inspections.map((insp, i) => <span key={i}>{fmtInspection(insp.start)}<br /></span>)}
                  or by private appointment
                </p>
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
              <div className="nm">{l.agents[0]?.name ?? "Harbourview Real Estate"}</div>
              <div className="ttl">{l.agents[0]?.title ?? "Sales"}</div>
              <EnquiryForm listingId={l.id} />
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
