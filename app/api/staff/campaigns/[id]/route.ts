import { NextResponse } from "next/server";
import { getStaff } from "@/lib/staff-auth";
import { getCampaign, updateCampaign, type Selection } from "@/lib/campaigns";
import { sendVendorLink } from "@/lib/vendor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clean = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

/** Save the review — selection, blurbs, vendor details. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const staff = getStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "Sign in first" }, { status: 401 });

  const current = await getCampaign(params.id);
  if (!current) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const sel = body?.selection ?? {};
  const selection: Selection = {
    excludedPhotos: Array.isArray(sel.excludedPhotos) ? sel.excludedPhotos.map(String).slice(0, 200) : current.selection.excludedPhotos,
    includeFloorplan: typeof sel.includeFloorplan === "boolean" ? sel.includeFloorplan : current.selection.includeFloorplan,
    includeCopy: typeof sel.includeCopy === "boolean" ? sel.includeCopy : current.selection.includeCopy,
    includeVideo: typeof sel.includeVideo === "boolean" ? sel.includeVideo : current.selection.includeVideo,
    boardId: sel.boardId === null ? null : clean(sel.boardId ?? current.selection.boardId, 120) || null,
    boardName: sel.boardId === null ? null : clean(sel.boardName ?? current.selection.boardName, 200) || null,
    brochureId: sel.brochureId === null ? null : clean(sel.brochureId ?? current.selection.brochureId, 120) || null,
    brochureName: sel.brochureId === null ? null : clean(sel.brochureName ?? current.selection.brochureName, 200) || null,
    blurbs: {
      board: clean(sel.blurbs?.board ?? current.selection.blurbs.board, 600),
      brochure: clean(sel.blurbs?.brochure ?? current.selection.blurbs.brochure, 600),
      copy: clean(sel.blurbs?.copy ?? current.selection.blurbs.copy, 600),
      floorplan: clean(sel.blurbs?.floorplan ?? current.selection.blurbs.floorplan, 600),
      images: clean(sel.blurbs?.images ?? current.selection.blurbs.images, 600),
      video: clean(sel.blurbs?.video ?? current.selection.blurbs.video, 600),
    },
  };

  const next = await updateCampaign(params.id, {
    selection,
    vendorName: body?.vendorName !== undefined ? clean(body.vendorName, 120) : current.vendorName,
    vendorEmail: body?.vendorEmail !== undefined ? clean(body.vendorEmail, 160).toLowerCase() : current.vendorEmail,
    // Copy can be tidied on the review screen — it's the approved wording, so
    // what's shown must be what's stored.
    copyText: body?.copyText !== undefined ? clean(body.copyText, 8000) : current.copyText,
    copyHeading: body?.copyHeading !== undefined ? clean(body.copyHeading, 200) : current.copyHeading,
  });

  return NextResponse.json({ ok: true, campaign: next });
}

/** Send (or re-send) the vendor their link. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const staff = getStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "Sign in first" }, { status: 401 });

  const c = await getCampaign(params.id);
  if (!c) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (!c.vendorName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.vendorEmail)) {
    return NextResponse.json({ ok: false, error: "Add the vendor's name and a valid email first." }, { status: 400 });
  }

  try {
    await sendVendorLink(c, staff.email);
  } catch (err) {
    console.error("[campaign] send failed", err);
    return NextResponse.json({ ok: false, error: "The email didn't send. Try again in a moment." }, { status: 502 });
  }

  const next = await updateCampaign(params.id, {
    status: c.status === "draft" ? "sent" : c.status,
    sentAt: new Date().toISOString(),
    sentBy: staff.email,
  });
  return NextResponse.json({ ok: true, campaign: next });
}
