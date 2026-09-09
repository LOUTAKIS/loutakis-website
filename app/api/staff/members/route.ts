import { NextResponse } from "next/server";
import { getStaff } from "@/lib/staff-auth";
import { approveBuyer, declineBuyer, getContact, removeCategory, addNote, CATEGORY_APPROVED } from "@/lib/portal";
import { removeApprovedContact } from "@/lib/portal-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Approve someone, or take their access away — from the members page rather
 * than from the email.
 *
 * The one-tap links in the notification email still work and always will: a
 * queue that requires signing in is a queue nobody clears. This is for the
 * other times — the email is lost, or someone approved months ago should no
 * longer be seeing private listings.
 *
 * Signed-in staff only, and every action leaves a note on the contact so the
 * CRM records who is on the list and why, not just that they are.
 */
export async function POST(req: Request) {
  const staff = getStaff();
  if (!staff) {
    return NextResponse.json({ ok: false, error: "Sign in at /staff first" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const contactId = String(body?.contactId ?? "").replace(/\D/g, "");
  const action = String(body?.action ?? "");
  if (!contactId || !["approve", "decline", "revoke"].includes(action)) {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  try {
    if (action === "approve") {
      // Sends them the "your access is open" email, writes their criteria into
      // the CRM, and adds them to the alert list — all of it, same as the
      // one-tap link.
      const { name } = await approveBuyer(contactId);
      await addNote(contactId, `Off-market access approved by ${staff.name} from the staff dashboard.`);
      return NextResponse.json({ ok: true, name });
    }

    if (action === "decline") {
      const { name } = await declineBuyer(contactId);
      return NextResponse.json({ ok: true, name });
    }

    /**
     * Revoke. The CRM category is what grants access, so removing it is what
     * actually locks them out — on their very next click, because the portal
     * re-reads the category on every page load rather than trusting a cookie.
     */
    const contact = await getContact(contactId);
    const consultantId = Number(contact?.consultant_id);
    if (!consultantId) throw new Error(`contact ${contactId} has no consultant_id`);
    await removeCategory(contactId, CATEGORY_APPROVED, consultantId);
    await removeApprovedContact(contactId).catch(() => {});
    await addNote(contactId, `Off-market access removed by ${staff.name} from the staff dashboard.`);

    const name = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || "That contact";
    return NextResponse.json({ ok: true, name });
  } catch (err) {
    console.error(`[members] ${action} ${contactId} failed`, err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "That didn't work." },
      { status: 502 }
    );
  }
}
