import { NextResponse } from "next/server";
import { getCampaign } from "@/lib/campaigns";
import { verifyToken } from "@/lib/portal-token";
import { approveCampaign, requestChanges, vendorFromToken } from "@/lib/vendor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The vendor approves, or asks for changes. Authorised by their link token only. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const payload = verifyToken(String(body?.t ?? ""));
  if (!payload || payload.a !== "vendor") {
    return NextResponse.json({ ok: false, error: "This link isn't valid any more. Call 0409 438 025." }, { status: 401 });
  }

  const c = await getCampaign(params.id);
  if (!c || c.status === "draft") return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (c.status === "approved") return NextResponse.json({ ok: true, already: true });

  /**
   * WHICH vendor this link belongs to. The token decides, not the browser —
   * that is what makes an approval attributable to the person we emailed
   * rather than to whatever name was typed into the box.
   */
  const who = vendorFromToken(c, payload.c);
  if (!who) {
    return NextResponse.json({ ok: false, error: "This link isn't valid any more. Call 0409 438 025." }, { status: 401 });
  }

  const name = String(body?.name ?? "").trim().slice(0, 120);
  const notes = String(body?.notes ?? "").trim().slice(0, 4000);
  const action = body?.action === "changes" ? "changes" : "approve";
  if (!name) return NextResponse.json({ ok: false, error: "Please enter your full name." }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = req.headers.get("user-agent") ?? "";

  try {
    if (action === "approve") {
      // Notes typed alongside an approval are kept with it — "approved, but
      // fix the typo in paragraph two" is a thing vendors do.
      const withNote = {
        ...c,
        amendments: notes
          ? [...c.amendments, { at: new Date().toISOString(), name, text: notes }]
          : c.amendments,
      };
      const result = await approveCampaign(withNote, who.vendor, name, { ip, userAgent });
      return NextResponse.json({
        ok: true,
        complete: result.complete,
        waitingOn: result.waitingOn.map((v) => v.name || v.email),
      });
    }
    await requestChanges(c, name, notes);
    return NextResponse.json({ ok: true, complete: false, waitingOn: [] });
  } catch (err) {
    console.error("[vendor] action failed", err);
    return NextResponse.json(
      { ok: false, error: "We couldn't record that just now. Please call 0409 438 025 and we'll take it by phone." },
      { status: 502 }
    );
  }
}
