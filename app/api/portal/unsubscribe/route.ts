import { verifyToken } from "@/lib/portal-token";
import { optOutOfAlerts } from "@/lib/portal-store";

/**
 * One-tap unsubscribe from new-listing emails.
 *
 * Required: the Spam Act 2003 obliges a functional unsubscribe on commercial
 * electronic messages, honoured without the recipient having to log in, reply
 * or explain themselves. One tap, no confirmation step, done.
 *
 * It stops the ALERTS only — their access to the off-market list is untouched,
 * because leaving the mailing list isn't the same as leaving the list.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const page = (title: string, body: string) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <title>${title} — Loutakis Real Estate</title>
     <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;margin:14vh auto;padding:0 24px;color:#111;line-height:1.6">
       <div style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#888;margin-bottom:18px">Loutakis Real Estate</div>
       <h1 style="font-size:26px;font-weight:600;margin:0 0 14px">${title}</h1>
       ${body}
     </div>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const payload = verifyToken(token);
  // The action must match: a sign-in link must never double as an unsubscribe.
  const contactId = payload?.a === "unsubscribe" ? payload.c : null;

  if (!contactId) {
    return page(
      "That link has expired",
      `<p>Reply to any of our emails, or call <a href="tel:0409438025">0409&nbsp;438&nbsp;025</a>, and we'll take you off the list.</p>`
    );
  }

  try {
    await optOutOfAlerts(contactId);
  } catch (err) {
    console.error("[unsubscribe] failed", err);
    return page(
      "Something went wrong",
      `<p>We couldn't update your preferences just now. Call <a href="tel:0409438025">0409&nbsp;438&nbsp;025</a> and we'll do it by hand.</p>`
    );
  }

  return page(
    "You're unsubscribed",
    `<p>We won't email you about new off-market properties again.</p>
     <p style="color:#666">Your access to the list itself is unchanged — you can still sign in and browse it whenever you like.</p>`
  );
}
