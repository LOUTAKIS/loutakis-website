import { getCampaign } from "@/lib/campaigns";
import { getMarketingSource } from "@/lib/boxdice";
import { verifyToken } from "@/lib/portal-token";
import { getStaff, staffDisplayName } from "@/lib/staff-auth";
import { recordOpen, AUTHORISATION_WORDING } from "@/lib/vendor";
import VendorApprovalForm from "@/components/VendorApprovalForm";
import VendorVideo from "@/components/VendorVideo";
import VendorFrame, { type Marker } from "@/components/vendor/VendorFrame";
import Photos from "@/components/vendor/Photos";
import Zoomable from "@/components/vendor/Zoomable";
import BrochurePages from "@/components/vendor/BrochurePages";
import Board from "@/components/vendor/Board";
import Copy from "@/components/vendor/Copy";

export const metadata = {
  title: "Review your marketing — Loutakis Real Estate",
  robots: { index: false, follow: false, noarchive: true },
};
export const dynamic = "force-dynamic";

function youTubeId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function Expired() {
  return (
    <section className="va-expired">
      <div>
        <div className="eyebrow">Loutakis Real Estate</div>
        <h2>That link isn&rsquo;t valid</h2>
        <p>It may have expired. Call Michael on <a href="tel:0409438025">0409&nbsp;438&nbsp;025</a> and we&rsquo;ll send a fresh one.</p>
      </div>
    </section>
  );
}

const first = (name: string) => name.trim().split(/\s+/)[0] || "";

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
  const isPreview = !vendorOk && searchParams?.preview === "1" && Boolean(getStaff());
  if (!vendorOk && !isPreview) return <Expired />;

  const c = await getCampaign(params.id);
  if (!c) return <Expired />;
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
  const sender = staffDisplayName(c.sentBy ?? c.createdBy);
  const senderIsMichael = /^michael/i.test(sender);
  const vendorFirst = first(c.vendorName);
  const approved = c.status === "approved";

  type Chapter = { id: string; label: string; title: string; blurb: string; body: React.ReactNode };
  const chapters: Chapter[] = [];

  if (c.selection.boardId)
    chapters.push({
      id: "board",
      label: "Board",
      title: "The board",
      blurb: b.board,
      body: <Board src={`/api/vendor/file/${c.id}/board${fileQ}`} />,
    });
  if (c.selection.brochureId)
    chapters.push({
      id: "brochure",
      label: "Brochure",
      title: "The brochure",
      blurb: b.brochure,
      body: <BrochurePages src={`/api/vendor/file/${c.id}/brochure${fileQ}`} name={c.selection.brochureName ?? "brochure.pdf"} />,
    });
  if (c.selection.includeCopy && c.copyText)
    chapters.push({
      id: "copy",
      label: "Copy",
      title: "The words",
      blurb: b.copy,
      body: <Copy heading={c.copyHeading} text={c.copyText} />,
    });
  if (floorplans.length)
    chapters.push({
      id: "floorplan",
      label: "Floorplan",
      title: "The floorplan",
      blurb: b.floorplan,
      body: (
        <div className="vplans">
          {floorplans.map((f, i) => (
            <Zoomable key={f.url} src={f.url} alt={`Floorplan${floorplans.length > 1 ? ` ${i + 1}` : ""}`} className="vz vz-plan" />
          ))}
        </div>
      ),
    });
  if (photos.length)
    chapters.push({
      id: "photos",
      label: "Photos",
      title: "The photographs",
      blurb: b.images,
      body: <Photos photos={photos} />,
    });
  if (vid)
    chapters.push({
      id: "video",
      label: "Video",
      title: "The film",
      blurb: b.video,
      body: <VendorVideo id={vid} />,
    });

  const markers: Marker[] = [...chapters.map((ch) => ({ id: ch.id, label: ch.label })), { id: "approve", label: "Approve" }];
  const minutes = Math.max(3, Math.round(chapters.length * 0.8 + (vid ? 1.5 : 0)));

  return (
    <div className="va2">
      <VendorFrame address={c.address} markers={markers} approved={approved} />
      {isPreview && <div className="va-preview">Preview — this is what {c.vendorName || "the vendor"} will see. Opens aren&rsquo;t counted.</div>}

      {/* Opening */}
      <section className="vh" style={hero ? { backgroundImage: `url(${hero})` } : undefined}>
        <div className="vh-inner">
          <div className="eyebrow">Your marketing, ready to review</div>
          <h1>{c.address}</h1>
          <p className="vh-line">
            {vendorFirst ? `${vendorFirst}, ` : ""}here&rsquo;s how we&rsquo;ll tell the story of your home.
            {senderIsMichael ? " Take a minute with it — the way it's told makes all the difference." : ` ${sender} has put this together for you.`}
          </p>
          <p className="vh-cue">
            {chapters.length} things to look at · about {minutes} minutes · then one tap to approve
          </p>
        </div>
        <a href={`#${markers[0]?.id ?? "approve"}`} className="vh-scroll" aria-label="Scroll to begin"><i /></a>
      </section>

      {chapters.map((ch, i) => (
        <section key={ch.id} className={`vch vch-${ch.id}`} id={ch.id}>
          <div className="vch-head">
            <div className="vch-num">{String(i + 1).padStart(2, "0")}<span> / {String(chapters.length).padStart(2, "0")}</span></div>
            <h2>{ch.title}</h2>
            {ch.blurb && <p className="vch-blurb">{ch.blurb}</p>}
          </div>
          <div className="vch-body">{ch.body}</div>
        </section>
      ))}

      <section className="vch vch-approve" id="approve">
        <div className="vch-head">
          <div className="vch-num">Last</div>
          <h2>{approved ? "Approved" : "Your approval"}</h2>
          {!approved && (
            <p className="vch-blurb">
              If it all looks right, put your name to it and we&rsquo;ll get moving. If something needs changing, say so here and it comes straight to {senderIsMichael ? "Michael" : sender}.
            </p>
          )}
        </div>
        <div className="vch-body">
          {approved ? (
            <div className="vdone">
              <div className="vdone-mark">✓</div>
              <h3>Approved by {c.approvedName}</h3>
              <p>
                On {new Date(c.approvedAt!).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Melbourne" })}. Production is under way.
              </p>
            </div>
          ) : (
            <VendorApprovalForm campaignId={c.id} token={vendorOk ? token : ""} wording={AUTHORISATION_WORDING} preview={isPreview} address={c.address} />
          )}
        </div>
      </section>

      <footer className="vfoot">
        <span>Loutakis Real Estate · 0409 438 025</span>
        <span>It&rsquo;s time to move.</span>
      </footer>
    </div>
  );
}
