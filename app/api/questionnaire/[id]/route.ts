import { NextResponse } from "next/server";
import { getQuestionnaire } from "@/lib/questionnaire";
import { verifyToken } from "@/lib/portal-token";
import { saveProgress, submitQuestionnaire } from "@/lib/questionnaire-deliver";
import { FIELD_BY_ID, missingRequired, type Answers } from "@/lib/questionnaire-form";
import type { MailAttachment } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The vendor saves, or sends. Authorised by their link token and nothing else.
 *
 * Two shapes arrive here: JSON for a save (no files), and multipart for the
 * final send (answers as a JSON field, files beside them). One route rather
 * than two, because both do the same authorisation against the same record and
 * splitting them would mean writing that twice.
 */

const MAX_TOTAL = 3_500_000;
const MAX_FILES = 10;

/**
 * Only fields we know about, only the types we expect.
 *
 * The form is the only thing that posts here, but the token is what authorises
 * the request and a token can be replayed by hand. Anything not in the
 * definition is dropped rather than stored — this record is written into a PDF
 * and an email, and unbounded strings from a request body have no business in
 * either.
 */
function clean(raw: unknown): Answers {
  const out: Answers = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const f = FIELD_BY_ID[k];
    if (!f) continue;
    if (f.kind === "multi") {
      if (!Array.isArray(v)) continue;
      const allowed = new Set(f.options ?? []);
      out[k] = v.map(String).filter((x) => allowed.has(x));
    } else if (f.kind === "choice") {
      const s = String(v ?? "");
      if ((f.options ?? []).includes(s)) out[k] = s;
    } else if (f.kind === "files") {
      // Files come as attachments, never as an answer value.
      continue;
    } else {
      out[k] = String(v ?? "").slice(0, 8000);
    }
  }
  return out;
}

const BAD_LINK = "This link isn't valid any more. Call 0409 438 025 and we'll send a fresh one.";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const type = req.headers.get("content-type") ?? "";
  let token = "";
  let action: "save" | "submit" = "save";
  let answers: Answers = {};
  let name = "";
  const files: MailAttachment[] = [];

  if (type.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
    token = String(form.get("t") ?? "");
    name = String(form.get("name") ?? "").trim().slice(0, 120);
    action = "submit";
    try {
      answers = clean(JSON.parse(String(form.get("answers") ?? "{}")));
    } catch {
      return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
    }

    let total = 0;
    for (const [key, value] of form.entries()) {
      if (!key.startsWith("file:") || typeof value === "string") continue;
      if (files.length >= MAX_FILES) break;
      const buf = Buffer.from(await value.arrayBuffer());
      total += buf.length;
      if (total > MAX_TOTAL) {
        return NextResponse.json(
          {
            ok: false,
            error: "Those files are too large to send in one go. Take some off and email them to us instead.",
          },
          { status: 413 }
        );
      }
      files.push({
        // Whatever the vendor's phone called it, minus anything that would
        // make a mess of a filename in an inbox.
        name: (value.name || "attachment").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120),
        contentType: value.type || "application/octet-stream",
        content: buf,
      });
    }
  } else {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
    token = String(body?.t ?? "");
    action = body?.action === "submit" ? "submit" : "save";
    answers = clean(body?.answers);
    name = String(body?.name ?? "").trim().slice(0, 120);
  }

  const payload = verifyToken(token);
  if (!payload || payload.a !== "questionnaire" || payload.c !== params.id) {
    return NextResponse.json({ ok: false, error: BAD_LINK }, { status: 401 });
  }

  const q = await getQuestionnaire(params.id);
  if (!q) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  // Already finished: say so rather than quietly sending the office a second copy.
  if (q.status === "complete") return NextResponse.json({ ok: true, already: true });

  try {
    if (action === "submit") {
      if (!name) {
        return NextResponse.json({ ok: false, error: "Please enter your full name." }, { status: 400 });
      }
      const gaps = missingRequired(answers);
      if (gaps.length) {
        return NextResponse.json(
          { ok: false, error: `${gaps[0].q} still needs an answer.` },
          { status: 400 }
        );
      }
      await submitQuestionnaire(q, name, answers, files);
    } else {
      await saveProgress(q, answers);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[questionnaire] action failed", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          "We couldn't record that just now. Your answers are still on this page — try again in a moment, or call 0409 438 025.",
      },
      { status: 502 }
    );
  }
}
