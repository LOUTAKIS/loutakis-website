import { NextResponse } from "next/server";
import { recordFormEvent, recordAbandon, recordDuration, isFormName } from "@/lib/form-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The three things a browser can tell us that a server cannot see for itself:
 * somebody started, somebody gave up on a particular question, and a completed
 * form took this long.
 *
 * `sent` and `failed` are NOT accepted here. Those are recorded by the routes
 * that actually do the work, where they are facts rather than claims — a
 * browser saying "that worked" is not evidence that it did, and the failure
 * that matters most is the one where the browser can report nothing at all.
 *
 * Deliberately unauthenticated, because the people it counts are strangers who
 * have not identified themselves. The blast radius of abuse is a wrong number
 * on an internal dashboard: nothing personal is stored, nothing is emailed, the
 * form name is checked against a closed list and the field name is stripped to
 * letters and digits.
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!isFormName(body?.form)) return NextResponse.json({ ok: false }, { status: 400 });

  switch (body?.outcome) {
    case "started":
      await recordFormEvent(body.form, "started");
      return NextResponse.json({ ok: true });

    case "abandoned":
      await recordAbandon(body.form, String(body?.field ?? ""));
      return NextResponse.json({ ok: true });

    case "finished":
      await recordDuration(body.form, Number(body?.seconds));
      return NextResponse.json({ ok: true });

    default:
      return NextResponse.json({ ok: false }, { status: 400 });
  }
}
