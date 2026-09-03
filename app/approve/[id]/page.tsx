import { getCampaign } from "@/lib/campaigns";
import { getMarketingSource } from "@/lib/boxdice";
import { verifyToken } from "@/lib/portal-token";
import { getStaff } from "@/lib/staff-auth";
import { recordOpen, AUTHORISATION_WORDING } from "@/lib/vendor";
import VendorApprovalForm from "@/components/VendorApprovalForm";
import VendorVideo from "@/components/VendorVideo";

export const metadata = {
  title: "Review your marketing — Loutakis Real Estate",
  robots: { index: false, follow: false, noarchive: true },
};
export const dynamic = "force-dynamic";

/** Extract a YouTube id from whatever form the link takes. */
function youTubeId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function Expired() {
  return (
    <section className="portal-page">
      <div className="wrap" style={{ maxWidth: 560 }}>
        <div className="eyebrow">Loutakis Real Estate</div>
        <h2>That link isn&rsquo;t valid</h2>
        <p className="portal-intro">
          It may have expired. Call Michael on <a href="tel:0409438025">0409&nbsp;438&nbsp;025</a> and we&rsquo;ll send a fresh one.
        </p>
      </div>
    </section>
  );
}

export default async function ApprovePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { t?: string; preview?: string };
}) {
  const token = searchParams?.t ?? "";
  const payload = verifyToken(token);
  const vendorOk = payload?.a === "vendor" && payload.c === params.id;
  // Staff can preview without a token — that never counts as an open.
  const isPreview = !vendorOk && searchParams?.preview === "1" && Boolean(getStaff());
  if (!vendorOk && !isPreview) return <Expired />;

  const c = await getCampaign(params.id);
  if (!c) return <Expired />;
  // A draft has no business being seen by a vendor; staff can still preview it.
  if (c.status === "draft" && !isPreview) return <Expired />;

  const source = await getMarketingSource(c.listingId);
  if (vendorOk) await recordOpen(c);

  const excluded = new Set(c.selection.excludedPhotos);
  const photos = (source?.photos ?? []).filter((p) => !excluded.has(p.url));
  const floorplans = c.selection.includeFloorplan ? source?.floorplans ?? [] : [];
  const vid = c.selection.includeVideo ? youTubeId(source?.videoUrl) : null;
  const fileQ = vendorOk ? `?t=${encodeURIComponent(token)}` : "";
  const hero = photos[0]?.url;
  const b = c.selection.blurbs;

  const sections: Array<{ key: string; title: string; blurb: string; body: React.ReactNode } | null> = [
    c.selection.boardId
      ? {
          key: "board",
          title: "Board",
          blurb: b.board,
          body: (
            <a className="va-file" href={`/api/vendor/file/${c.id}/board${fileQ}`} target="_blank" rel="noopener">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/vendor/file/${c.id}/board${fileQ}`} alt="Signboard artwork" />
              <span>Open full size ↗</span>
            </a>
          ),
        }
      : null,
    c.selection.brochureId
      ? {
          key: "brochure",
          title: "Brochure",
          blurb: b.brochure,
          body: (
            <a className="btn" href={`/api/vendor/file/${c.id}/brochure${fileQ}`} target="_blank" rel="noopener">
              View the brochure ↗
            </a>
          ),
        }
      : null,
    c.selection.includeCopy && c.copyText
      ? {
          key: "copy",
          title: "Copy",
          blurb: b.copy,
          body: (
            <div className="va-copy">
              {c.copyHeading && <h4>{c.copyHeading}</h4>}
              {c.copyText.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ),
        }
      : null,
    floorplans.length
      ? {
          key: "floorplan",
          title: "Floorplan",
          blurb: b.floorplan,
          body: (
            <div className="va-plans">
              {floorplans.map((f) => (
                <a key={f.url} href={f.url} target="_blank" rel="noopener">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt="Floorplan" />
                </a>
              ))}
            </div>
          ),
        }
      : null,
    photos.length
      ? {
          key: "images",
          title: "Images",
          blurb: b.images,
          body: (
            <div className="va-gallery">
              {photos.map((p) => (
                <a key={p.url} href={p.url} target="_blank" rel="noopener">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" loading="lazy" />
                </a>
              ))}
            </div>
          ),
        }
      : null,
    vid ? { key: "video", title: "Video", blurb: b.video, body: <VendorVideo id={vid} /> } : null,
  ];

  return (
    <div className="va">
      {isPreview && <div className="va-preview">Preview — this is what the vendor sees. Opens aren&rsquo;t counted.</div>}

      <section className="va-hero" style={hero ? { backgroundImage: `url(${hero})` } : undefined}>
        <div className="wrap">
          <h1>Take a minute, the way we tell your story online can make all the difference.</h1>
          <p>{c.address}</p>
        </div>
      </section>

      <section className="va-intro">
        <div className="wrap">
          <h2>Make it stand out.</h2>
        </div>
      </section>

      {sections.filter(Boolean).map((s) => (
        <section key={s!.key} className="va-section" id={s!.key}>
          <div className="wrap">
            <div className="eyebrow">{s!.title}</div>
            {s!.blurb && <p className="va-blurb">{s!.blurb}</p>}
            {s!.body}
          </div>
        </section>
      ))}

      <section className="va-approve">
        <div className="wrap" style={{ maxWidth: 680 }}>
          <div className="eyebrow">Approval</div>
          <h2>it&rsquo;s time to move.</h2>
          {c.status === "approved" ? (
            <div className="portal-done">
              <h3>Approved</h3>
              <p>
                {c.approvedName} approved this marketing on{" "}
                {new Date(c.approvedAt!).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Melbourne" })}.
                Production is under way.
              </p>
            </div>
          ) : (
            <VendorApprovalForm campaignId={c.id} token={vendorOk ? token : ""} wording={AUTHORISATION_WORDING} preview={isPreview} />
          )}
        </div>
      </section>
    </div>
  );
}
