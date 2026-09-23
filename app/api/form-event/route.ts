import { NextResponse } from "next/server";
import { recordFormEvent, isFormName } from "@/lib/form-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Somebody started filling this in."
 *
 * The one part of the funnel a server cannot see for itself: a person who types
 * their name, thinks better of it and closes the tab never reaches any of our
 * routes. Without it the panel can say how many enquiries arrived but not how
 * many were abandoned, and the gap between those two is the only number that
 * says whether a form is too long or something on it is broken.
 *
 * STARTED ONLY. `sent` and `failed` are recorded by the routes that actually
 * do the work, where they are facts rather than claims — a browser saying "that
 * worked" is not evidence that it did. Anything else posted here is rejected.
 *
 * Deliberately unauthenticated, because the people it counts are strangers who
 * have not identified themselves. The blast radius of abuse is one inflated
 * number on an internal dashboard: no personal data is stored, nothing is
 * emailed, and the form name is checked against a closed list.
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!isFormName(body?.form)) return NextResponse.json({ ok: false }, { status: 400 });
  if (body?.outcome !== "started") return NextResponse.json({ ok: false }, { status: 400 });

  await recordFormEvent(body.form, "started");
  return NextResponse.json({ ok: true });
}
