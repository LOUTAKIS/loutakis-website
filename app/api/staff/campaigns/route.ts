import { NextResponse } from "next/server";
import { getStaff } from "@/lib/staff-auth";
import { getMarketingSource } from "@/lib/boxdice";
import { findPropertyFolder, listMediaSection } from "@/lib/sharepoint";
import { newCampaignId, saveCampaign, listCampaigns, DEFAULT_BLURBS, type Campaign } from "@/lib/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Start a campaign: gather what both systems hold for the listing and save a
 * draft with everything ticked. The staff member then unticks on the review
 * screen. Nothing is sent from here.
 */
export async function POST(req: Request) {
  const staff = getStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "Sign in first" }, { status: 401 });

  let listingId = 0;
  try {
    listingId = Number((await req.json())?.listingId);
  } catch {
    /* fall through */
  }
  if (!listingId) return NextResponse.json({ ok: false, error: "listingId required" }, { status: 400 });

  // One live approval per listing: if one is already in flight, open that.
  const open = (await listCampaigns()).find((c) => c.listingId === listingId && c.status !== "approved");
  if (open) return NextResponse.json({ ok: true, id: open.id, existing: true });

  const source = await getMarketingSource(listingId);
  if (!source) return NextResponse.json({ ok: false, error: "Listing not found in Box & Dice" }, { status: 404 });

  // SharePoint: best-effort. A missing folder is shown on the review screen,
  // not treated as an error — the board may not exist yet.
  let folderPath: string | null = null;
  let boardId: string | null = null;
  let boardName: string | null = null;
  let brochureId: string | null = null;
  let brochureName: string | null = null;
  try {
    const { match } = await findPropertyFolder(source.streetName, source.number);
    if (match) {
      folderPath = match.path;
      const [board, brochure] = await Promise.all([
        listMediaSection(match.path, "BOARD"),
        listMediaSection(match.path, "BROCHURE"),
      ]);
      // If the folder holds several files, take the most recently modified;
      // the review screen shows which and lets the staff member change it.
      const latest = (xs: typeof board) => [...xs].sort((a, b) => b.modified.localeCompare(a.modified))[0];
      const b = latest(board);
      const br = latest(brochure);
      if (b) { boardId = b.id; boardName = b.name; }
      if (br) { brochureId = br.id; brochureName = br.name; }
    }
  } catch (err) {
    console.error("[campaign] SharePoint gather failed", err);
  }

  const campaign: Campaign = {
    id: newCampaignId(),
    listingId: source.id,
    address: source.address,
    street: source.streetName,
    number: source.number,
    folderPath,
    vendorName: "",
    vendorEmail: "",
    createdBy: staff.email,
    createdAt: new Date().toISOString(),
    sentAt: null,
    sentBy: null,
    openedAt: null,
    openCount: 0,
    status: "draft",
    approvedAt: null,
    approvedName: null,
    amendments: [],
    selection: {
      excludedPhotos: [],
      includeFloorplan: source.floorplans.length > 0,
      includeCopy: source.copyText.length > 0,
      includeVideo: Boolean(source.videoUrl),
      boardId,
      boardName,
      brochureId,
      brochureName,
      blurbs: { ...DEFAULT_BLURBS },
    },
    copyText: source.copyText,
    copyHeading: source.copyHeading,
  };

  await saveCampaign(campaign);
  return NextResponse.json({ ok: true, id: campaign.id });
}
