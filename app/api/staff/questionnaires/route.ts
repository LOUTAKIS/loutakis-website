import { NextResponse } from "next/server";
import { getStaff } from "@/lib/staff-auth";
import { getMarketingSource } from "@/lib/boxdice";
import {
  newQuestionnaireId,
  saveQuestionnaire,
  questionnaireForListing,
  type Questionnaire,
} from "@/lib/questionnaire";
import { sendQuestionnaireLink, questionnaireLink } from "@/lib/questionnaire-deliver";
import type { Vendor } from "@/lib/vendors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Staff create a questionnaire against a listing and send it.
 *
 * The address and the agent come from Box & Dice, not from the browser: the
 * page that posts here already shows them, but what is SAVED has to be what the
 * CRM says, or a mistyped address ends up on a document and in a CRM note.
 * The vendors are typed in, because the Website API does not carry them —
 * the same reason the marketing approval asks for them.
 */
export async function POST(req: Request) {
  const staff = getStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });

  const listingId = Number(body?.listingId);
  if (!listingId) return NextResponse.json({ ok: false, error: "Which property?" }, { status: 400 });

  const vendors: Vendor[] = (Array.isArray(body?.vendors) ? body.vendors : [])
    .map((v: any) => ({
      name: String(v?.name ?? "").trim().slice(0, 120),
      email: String(v?.email ?? "").trim().toLowerCase().slice(0, 200),
    }))
    .filter((v: Vendor) => v.email);

  if (!vendors.length) {
    return NextResponse.json(
      { ok: false, error: "Add at least one vendor with an email address." },
      { status: 400 }
    );
  }
  if (vendors.some((v) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email))) {
    return NextResponse.json({ ok: false, error: "One of those email addresses isn't right." }, { status: 400 });
  }

  const existing = await questionnaireForListing(listingId);
  if (existing && existing.status !== "complete") {
    // Re-sending is a normal thing to do — chasing is most of the job — so
    // this is not an error, it just doesn't make a second record.
    await sendQuestionnaireLink({ ...existing, vendors }, staff.email);
    return NextResponse.json({ ok: true, id: existing.id, resent: true });
  }

  const source = await getMarketingSource(listingId);
  if (!source) {
    return NextResponse.json({ ok: false, error: "That listing isn't in Box & Dice." }, { status: 404 });
  }

  const agent = source.agents[0];
  const q: Questionnaire = {
    id: newQuestionnaireId(),
    listingId,
    address: source.address,
    vendors,
    agentName: agent?.name ?? "",
    agentEmail: agent?.email ?? "",
    createdBy: staff.email,
    createdAt: new Date().toISOString(),
    sentAt: null,
    sentBy: null,
    openedAt: null,
    openCount: 0,
    status: "sent",
    answers: {},
    submittedAt: null,
    submittedName: null,
  };

  await saveQuestionnaire(q);
  await sendQuestionnaireLink(q, staff.email);

  return NextResponse.json({ ok: true, id: q.id, link: questionnaireLink(q.id) });
}
