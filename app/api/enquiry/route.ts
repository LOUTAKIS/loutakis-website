import { NextResponse } from "next/server";
import { sendEnquiry, mailIsConfigured } from "@/lib/mail";
import { getListings, getOffMarketListings } from "@/lib/boxdice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LEN = 5000;
const ALLOWED_DOMAIN = "@loutakis.com.au";

function clean(v: unknown, max = 200): string {
  return String(v ?? "").trim().slice(0, max);
}

/**
 * Work out who should receive this enquiry.
 *
 * A property enquiry goes to the agent the buyer chose on that listing; a
 * general enquiry goes to ENQUIRY_TO. Addresses are looked up from Box & Dice
 * SERVER-SIDE using the listing id, and the browser sends only an INDEX into
 * that list — never an address. If it could send an address, the form would be
 * an open relay for mail originating from our own domain. Anything outside our
 * domain is ignored, and we fall back to ENQUIRY_TO rather than lose a lead.
 */
/**
 * The full address for a listing id, straight from the CRM.
 *
 * Same principle as the recipients above: what the office is told a property
 * IS should come from Box & Dice, not from a form field anyone can edit. It
 * also lets the private list send no address whatsoever — see the portal,
 * where even the street number is withheld from the page.
 *
 * Off-market listings are not in getListings(), so both lists are searched.
 */
async function addressFor(listingId: string): Promise<string | undefined> {
  if (!listingId) return undefined;
  try {
    const [current, offMarket] = await Promise.all([getListings(), getOffMarketListings()]);
    const l = [...current, ...offMarket].find((x) => x.id === listingId);
    return l ? `${l.address.street}, ${l.address.suburb}` : undefined;
  } catch (err) {
    console.error("[enquiry] address lookup failed", err);
    return undefined;
  }
}

async function resolveRecipients(
  listingId: string,
  agentIndex?: number
): Promise<string[] | undefined> {
  if (!listingId) return undefined;

  try {
    /**
     * Both lists. An off-market listing is not in getListings() — it is
     * excluded from the public site by definition — so searching only that one
     * sent every private-list enquiry to ENQUIRY_TO instead of the agent
     * running the campaign.
     */
    const [current, offMarket] = await Promise.all([getListings(), getOffMarketListings()]);
    const listing = [...current, ...offMarket].find((l) => l.id === listingId);
    if (!listing) return undefined;

    const agentEmails = listing.agents
      .map((a) => (a.email ?? "").trim().toLowerCase())
      .filter((e) => e.endsWith(ALLOWED_DOMAIN));

    if (!agentEmails.length) return undefined;

    // The buyer picked a specific agent — honour it, if the index is real.
    if (
      typeof agentIndex === "number" &&
      Number.isInteger(agentIndex) &&
      agentIndex >= 0 &&
      agentIndex < agentEmails.length
    ) {
      return [agentEmails[agentIndex]];
    }

    // No choice made (single-agent listing, or an index we don't trust):
    // everyone on the listing, so nothing goes unanswered.
    return agentEmails;
  } catch (err) {
    // Never lose an enquiry over a lookup failure — fall back to ENQUIRY_TO.
    console.error("[enquiry] agent lookup failed, using default recipient", err);
    return undefined;
  }
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // Honeypot: a hidden field real people never fill in. Accept silently so
  // bots do not learn they were caught, but send nothing.
  if (clean(body?.company)) {
    return NextResponse.json({ ok: true });
  }

  const name = clean(body?.name);
  const email = clean(body?.email);
  const phone = clean(body?.phone, 50);
  const message = clean(body?.message, MAX_LEN);

  if (!name || !email || !message) {
    return NextResponse.json(
      { ok: false, error: "Please fill in your name, email and message." },
      { status: 400 }
    );
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "That email address doesn't look right." },
      { status: 400 }
    );
  }

  if (!mailIsConfigured()) {
    // Loud on the server, honest to the visitor. Never pretend it was sent.
    console.error("[enquiry] REJECTED — mail is not configured", { name, email });
    return NextResponse.json(
      {
        ok: false,
        error:
          "Sorry — our enquiry form is temporarily unavailable. Please call 0409 438 025 or email michael@loutakis.com.au.",
      },
      { status: 503 }
    );
  }

  const listingId = clean(body?.listingId, 50);
  const rawIndex = body?.agentIndex;
  const agentIndex = typeof rawIndex === "number" ? rawIndex : undefined;

  try {
    const to = await resolveRecipients(listingId, agentIndex);

    await sendEnquiry({
      name,
      email,
      phone: phone || undefined,
      message,
      listingId: listingId || undefined,
      /**
       * Resolved from the id where we can, and only otherwise taken from the
       * browser. The private list never sends an address at all — it does not
       * even render the street number — so without this the office would get an
       * enquiry it could not tie to a property.
       */
      listingAddress: (await addressFor(listingId)) || clean(body?.listingAddress) || undefined,
      pageUrl: clean(body?.pageUrl, 500) || undefined,
      to,
    });

    // Durable-ish trail in the Vercel logs alongside the email.
    console.log("[enquiry] sent", {
      name,
      email,
      listingId: listingId || null,
      routedTo: to ?? "ENQUIRY_TO (default)",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[enquiry] SEND FAILED", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Sorry — we couldn't send that just now. Please call 0409 438 025 or email michael@loutakis.com.au.",
      },
      { status: 502 }
    );
  }
}
