import { NextResponse } from "next/server";
import { getViewer } from "@/lib/portal-session";
import { getContact, addNote } from "@/lib/portal";
import { getRegisteredEmail } from "@/lib/portal-store";
import { getOffMarketListings } from "@/lib/boxdice";
import { sendEnquiry } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Enquire" on the private list — one click, no form.
 *
 * A member of the off-market list has already registered, been approved by
 * hand, and signed in. Asking them to type their name, email and phone again
 * is asking for something we already hold, and every field is a place to give
 * up. So the button sends: who they are comes from their session, not from
 * anything the browser claims.
 *
 * NOTHING IS TAKEN FROM THE REQUEST BUT A LISTING ID, and that id is checked
 * against the off-market list itself — so this cannot be used to enquire on a
 * property the caller was never shown, or to send mail on behalf of anyone but
 * themselves.
 */

const ALLOWED_DOMAIN = "@loutakis.com.au";

export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  }
  if (viewer.status !== "approved") {
    return NextResponse.json({ ok: false, error: "Your access isn't active." }, { status: 403 });
  }

  let listingId = "";
  try {
    listingId = String((await req.json())?.listingId ?? "").slice(0, 50);
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  if (!listingId) {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  // The listing must be ON the private list right now. A property untagged an
  // hour ago is no longer ours to take enquiries about.
  const listing = (await getOffMarketListings().catch(() => [])).find((l) => l.id === listingId);
  if (!listing) {
    return NextResponse.json(
      { ok: false, error: "That property is no longer on the list." },
      { status: 404 }
    );
  }

  let contact: any;
  try {
    contact = await getContact(viewer.contactId);
  } catch (err) {
    console.error("[portal enquiry] contact read failed", err);
    return NextResponse.json(
      { ok: false, error: "We couldn't send that just now. Please call 0409 438 025." },
      { status: 502 }
    );
  }

  const name = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ").trim() || "A buyer";
  /**
   * The address they REGISTERED with, ahead of the CRM's primary — the primary
   * can be an old work address on a contact matched by name and mobile, and an
   * agent replying to it would be writing to the wrong place. Same rule as the
   * approval email.
   */
  const registered = await getRegisteredEmail(viewer.contactId).catch(() => null);
  const email = registered || String(contact?.email ?? "").trim();
  const phone = String(contact?.mobile ?? "").trim();

  const address = `${listing.address.street}, ${listing.address.suburb}`;

  // Their own agent on the listing, resolved server-side. Falls back to the
  // office inbox inside sendEnquiry when a listing has no usable address.
  const to = listing.agents
    .map((a) => (a.email ?? "").trim().toLowerCase())
    .filter((e) => e.endsWith(ALLOWED_DOMAIN));

  try {
    await sendEnquiry({
      name,
      email: email || "no email on file",
      phone: phone || undefined,
      message:
        "Enquired from the off-market list — one-click, so there is no message. " +
        "They are asking for a call about this property.",
      listingId: listing.id,
      listingAddress: address,
      to: to.length ? to : undefined,
    });
  } catch (err) {
    console.error("[portal enquiry] send failed", err);
    return NextResponse.json(
      { ok: false, error: "We couldn't send that just now. Please call 0409 438 025." },
      { status: 502 }
    );
  }

  /**
   * A note on their CRM record too, best effort. The email is what gets someone
   * to ring today; the note is what tells whoever opens the contact in three
   * weeks that this buyer asked about this house. A failed note must never turn
   * a sent enquiry into an error.
   */
  addNote(viewer.contactId, `Enquired about ${address} from the off-market list on the website.`).catch(
    (err) => console.error("[portal enquiry] note failed", err)
  );

  return NextResponse.json({ ok: true });
}
