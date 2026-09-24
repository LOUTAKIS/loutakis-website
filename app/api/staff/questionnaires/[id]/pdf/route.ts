import { getStaff } from "@/lib/staff-auth";
import { getQuestionnaire, questionnaireVendors } from "@/lib/questionnaire";
import { questionnairePdf, pdfFilename } from "@/lib/questionnaire-pdf";
import { getLiveSections } from "@/lib/questionnaire-questions";
import { askedOf } from "@/lib/questionnaire-deliver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The questionnaire as a PDF, on demand.
 *
 * Built fresh each time rather than stored: it is a few kilobytes of text, the
 * answers are already in the record, and a stored copy would be the one that
 * went stale the first time a vendor rang to correct something. Staff only —
 * this document holds everything a vendor told us in confidence.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!getStaff()) return new Response("Not signed in", { status: 401 });

  const q = await getQuestionnaire(params.id);
  if (!q) return new Response("Not found", { status: 404 });

  const pdf = await questionnairePdf({
    address: q.address,
    sections: askedOf(q, await getLiveSections()),
    answers: q.answers ?? {},
    submittedName: q.submittedName,
    submittedAt: q.submittedAt,
    vendors: questionnaireVendors(q),
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFilename(q.address)}"`,
      "Cache-Control": "no-store",
    },
  });
}
