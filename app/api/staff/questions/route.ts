import { NextResponse } from "next/server";
import { getStaff } from "@/lib/staff-auth";
import { saveQuestionSet } from "@/lib/questionnaire-questions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Save the question set. Any signed-in staff member — the form belongs to
 * whoever reads the answers, which is the office rather than one person.
 *
 * The body is structurally cleaned in saveQuestionSet before it is written:
 * this set is rendered to vendors and typeset into a PDF, so it is validated
 * rather than trusted even coming from behind the staff sign-in.
 */
export async function POST(req: Request) {
  const staff = getStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });

  try {
    const saved = await saveQuestionSet(body?.sections, staff.name || staff.email);
    const live = saved.sections.flatMap((s) => s.fields).filter((f) => !f.retired).length;
    console.log(`[questions] saved by ${staff.email} — ${live} live`);
    return NextResponse.json({ ok: true, live });
  } catch (err) {
    console.error("[questions] save failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Couldn't save that." },
      { status: 502 }
    );
  }
}
