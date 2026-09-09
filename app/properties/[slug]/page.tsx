import { plural } from "@/lib/plural";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getListingBySlug } from "@/lib/boxdice";
import { STATUS_LABEL } from "@/lib/types";
import EnquiryForm from "@/components/EnquiryForm";
import Gallery from "@/components/Gallery";
import PropertyVideoHero from "@/components/PropertyVideoHero";
import { fmtInspection, fmtMoment } from "@/lib/when";
import AddToCalendar from "@/components/AddToCalendar";
import { inspectionEvent, auctionEvent } from "@/lib/listing-events";

/** Extract a YouTube video id from a Box & Dice video link. */
function youTubeId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export const revalidate = 600;

/**
 * No property pages are pre-rendered at build time. Box & Dice rate-limits
 * hard enough that generating ~30 pages in one build gets the whole build
 * throttled (Vercel killed one at 6 minutes, 2 Sep 2026). Each page renders
 * on its first request instead and is then cached for `revalidate` seconds —
 * identical behaviour after the first visit, and the build makes only the
 * handful of calls the home and listings pages need.
 */
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
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


export default async function PropertyPage({ params }: { params: { slug: string } }) {
  const l = await getListingBySlug(params.slug);
  if (!l) notFound();

  const vid = youTubeId(l.videoUrl);

  /**
   * Built here from the same helpers the .ics route uses, so the Google link
   * beside a time and the file behind it can never disagree about that time.
   */
  const auction = auctionEvent(l);
  const inspections = (l.inspections ?? []).map((_, i) => inspectionEvent(l, i));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: `${l.address.street}, ${l.address.suburb}`,
    description: l.description,
    image: l.images.map((i) => i.url),
    url: `/properties/${l.slug}`,
  };

  return (
    <section style={{ paddingTop: vid ? 0 : 40 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {vid && <PropertyVideoHero id={vid} />}
      {/* detail-body sits above the sticky hero and paints its own background,
          so the content scrolls up over the film rather than through it. */}
      <div className={vid ? "detail-body" : undefined}>
      <div
        className="wrap"
        style={vid ? { paddingTop: 36 } : undefined}
      >
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
                {l.videoUrl && !vid && (
                  <a href={l.videoUrl} target="_blank" rel="noopener noreferrer" className="btn"
                    style={{ marginTop: 16, marginRight: 28 }}>
                    &#9654;&nbsp; Watch video
                  </a>
                )}
                {l.soiUrl && (
                  // The padding here was sized for a box that no longer exists.
                  <a href={l.soiUrl} target="_blank" rel="noopener noreferrer" className="btn"
                    style={{ marginTop: 16, fontSize: 9, letterSpacing: ".15em" }}>
                    Statement of Information
                  </a>
                )}
              </div>
              <div>
                {/* Never advertise an auction on a sold or leased property.
                    Box & Dice often leaves the auction flag set after a sale,
                    so the campaign status is the source of truth here, not the
                    auction date. */}
                {l.auctionAt && l.status !== "sold" && l.status !== "leased" && (
                  <div style={{ marginBottom: 18 }}>
                    <div className="times-label">Auction</div>
                    {/* The glyph sits beside the date, not under it — one line
                        that reads "when, and add it", the same shape as each
                        inspection below. */}
                    <div className="when-row">
                      <span>{fmtMoment(l.auctionAt)}</span>
                      {auction && (
                        <AddToCalendar
                          event={auction}
                          href={`/api/calendar/${l.slug}?auction=1`}
                          label="Add auction to calendar"
                        />
                      )}
                    </div>
                  </div>
                )}
                {/* Same again for inspections — a sold property must never
                    advertise an open, or someone turns up to a house that
                    has gone. */}
                {l.inspections && l.inspections.length > 0 && l.status !== "sold" && l.status !== "leased" && (
                  <div>
                    <div className="times-label">Inspections</div>
                    <ul className="insp-list">
                      {l.inspections.map((insp, i) => (
                        <li key={i}>
                          <span className="insp-when">{fmtInspection(insp.start, insp.end)}</span>
                          {inspections[i] && (
                            <AddToCalendar event={inspections[i]!} href={`/api/calendar/${l.slug}?i=${i}`} />
                          )}
                        </li>
                      ))}
                    </ul>
                    <p style={{ color: "var(--muted)" }}>or by private appointment</p>
                  </div>
                )}
              </div>
            </div>

            <div className="feat">
              <div><span className="n">{l.bed}</span><span className="l">{plural(l.bed, "Bed")}</span></div>
              <div><span className="n">{l.bath}</span><span className="l">{plural(l.bath, "Bath")}</span></div>
              <div><span className="n">{l.car}</span><span className="l">{plural(l.car, "Car")}</span></div>
              {/* Never state a land size as fact: the measurement is indicative. */}
              {l.landSize && <div><span className="n">{l.landSize}</span><span className="l">Land approx.</span></div>}
            </div>

            {/* The advertising copy exactly as it is written in Box & Dice:
                the heading as its own line, then the paragraphs as typed.
                `headline` falls back to the address when the CRM has no
                heading, so only show it when it is a real heading. */}
            {l.headline && l.headline !== `${l.address.street}, ${l.address.suburb}` && (
              <p className="listing-headline">{l.headline}</p>
            )}
            {l.description.split(/\n\s*\n/).map((para, i) => (
              <p key={i} className="listing-copy">{para.trim()}</p>
            ))}

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
              {/* Every consultant Box & Dice has on this listing, in B&D's own
                  order. The enquiry form below lets the buyer pick which one
                  they are contacting. */}
              {l.agents.length > 0 ? (
                <div className="agent-people">
                {l.agents.map((a, i) => (
                  <div key={i} className="agent-person">
                    {a.photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="agent-photo" src={a.photo} alt={a.name} />
                    )}
                    <div className="nm">{a.name}</div>
                    <div className="ttl">{a.title ?? "Sales"}</div>
                    {(a.phone || a.email) && (
                      <div className="agent-contact">
                        {a.phone && (
                          <a href={`tel:${a.phone.replace(/\s+/g, "")}`}>{a.phone}</a>
                        )}
                        {a.email && <a href={`mailto:${a.email}`}>{a.email}</a>}
                      </div>
                    )}
                  </div>
                ))}
                </div>
              ) : (
                <>
                  <div className="nm">Loutakis Real Estate</div>
                  <div className="ttl">Sales</div>
                </>
              )}

              <EnquiryForm
                listingId={l.id}
                listingAddress={`${l.address.street}, ${l.address.suburb}`}
                agentNames={l.agents.map((a) => a.name)}
              />
            </div>
          </aside>
        </div>
      </div>
      </div>
    </section>
  );
}
