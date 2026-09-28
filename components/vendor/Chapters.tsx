import type { Campaign } from "@/lib/campaigns";
import type { MarketingSource } from "@/lib/boxdice";
import VendorVideo from "@/components/VendorVideo";
import Photos from "./Photos";
import Zoomable from "./Zoomable";
import BrochureFold from "./BrochureFold";
import Board from "./Board";
import Copy from "./Copy";
import { panelUrls } from "@/lib/brochure-render";
import type { Marker } from "./VendorFrame";

/**
 * The campaign itself: board, brochure, words, floorplan, photographs, film.
 *
 * Shared by the vendor's own approval page and by the password-protected
 * example at /marketingapproval, because the whole point of that example is
 * that it is the same page. Two copies of this would drift, and the one that
 * drifts is the one a prospective vendor is shown.
 *
 * Everything about WHO is approving lives outside this — the chapters are the
 * marketing, and the marketing is the same whoever is looking at it.
 */

export type Chapter = {
  id: string;
  label: string;
  title: string;
  blurb: string;
  body: React.ReactNode;
  aside?: React.ReactNode;
};

function youTubeId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function buildChapters(
  c: Campaign,
  source: MarketingSource | null,
  fileQ: string
): { chapters: Chapter[]; markers: Marker[]; hero?: string } {
  const excluded = new Set(c.selection.excludedPhotos);
  const photos = (source?.photos ?? []).filter((p) => !excluded.has(p.url));
  const floorplans = c.selection.includeFloorplan ? source?.floorplans ?? [] : [];
  const vid = c.selection.includeVideo ? youTubeId(source?.videoUrl) : null;
  const b = c.selection.blurbs;

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
      body: (
        <BrochureFold
          src={`/api/vendor/file/${c.id}/brochure${fileQ}`}
          name={c.selection.brochureName ?? "brochure.pdf"}
          panels={panelUrls(c.id, c.selection.brochureId)}
        />
      ),
      aside: <div id="bf-controls-slot" />,
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
            <Zoomable
              key={f.url}
              src={f.url}
              alt={`Floorplan${floorplans.length > 1 ? ` ${i + 1}` : ""}`}
              className="vz vz-plan"
            />
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
      body: <VendorVideo id={vid} poster={photos[0]?.url} />,
    });

  return {
    chapters,
    markers: [...chapters.map((ch) => ({ id: ch.id, label: ch.label })), { id: "approve", label: "Approve" }],
    hero: photos[0]?.url,
  };
}

/** The chapters as sections. Identical wherever they are rendered. */
export function ChapterSections({ chapters }: { chapters: Chapter[] }) {
  return (
    <>
      {chapters.map((ch) => (
        <section key={ch.id} className={`vch vch-${ch.id}`} id={ch.id}>
          <div className="vch-head">
            <h2>{ch.title}</h2>
            {ch.blurb && <p className="vch-blurb">{ch.blurb}</p>}
            {ch.aside}
          </div>
          <div className="vch-body">{ch.body}</div>
        </section>
      ))}
    </>
  );
}
