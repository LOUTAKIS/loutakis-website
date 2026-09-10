import { NextResponse } from "next/server";
import { getViewer } from "@/lib/portal-session";
import { recordActivity, type ActivityKind } from "@/lib/portal-activity";
import { getListings, getOffMarketListings } from "@/lib/boxdice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A member opened something. Called from the browser, ignored for everyone
 * else.
 *
 * THE PAGE NEVER SAYS WHO IT IS. It posts "a property page was opened, this
 * listing id" and the server decides whether there is a signed-in member to
 * attribute it to. That means the beacon can sit on public property pages
 * without those pages knowing anything about their visitor, and a visitor who
 * is not a member is recorded nowhere at all.
 *
 * Always answers 204: this is a beacon, nothing renders from it, and a page
 * should never show an error because a log line failed.
 */

const KINDS: ActivityKind[] = ["list", "view"];

export async function POST(req: Request) {
  const nothing = new NextResponse(null, { status: 204 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return nothing;
  }

  const kind = String(body?.kind ?? "") as ActivityKind;
  if (!KINDS.includes(kind)) return nothing;

  const viewer = await getViewer();
  if (!viewer || viewer.status !== "approved") return nothing;

  const listingId = String(body?.listingId ?? "").slice(0, 50);

  /**
   * The address is resolved from the CRM, not taken from the page. A log is
   * only worth keeping if what it says happened is what happened, and a field
   * the browser can set is a field the browser can lie about.
   */
  let address: string | undefined;
  if (listingId) {
    try {
      const [current, off] = await Promise.all([getListings(), getOffMarketListings()]);
      const l = [...current, ...off].find((x) => x.id === listingId);
      address = l ? `${l.address.street}, ${l.address.suburb}` : undefined;
    } catch {
      // A missing address is a cosmetic loss; the id still identifies it.
    }
  }

  await recordActivity(viewer.contactId, {
    k: kind,
    ...(listingId ? { p: listingId } : {}),
    ...(address ? { a: address } : {}),
  });

  return nothing;
}
