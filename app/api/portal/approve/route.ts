import { NextResponse } from "next/server";
import { approveBuyer, declineBuyer } from "@/lib/portal";
import { verifyToken, tokensConfigured } from "@/lib/portal-token";

/**
 * One-tap approve / decline from the notification email. No login, because a
 * queue that requires signing in is a queue nobody clears.
 *
 * Authority comes from the signed token, which only exists in the email sent to
 * the office. Returns a plain HTML page — this is opened by a person on a
 * phone, not by code.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(title: string, body: string, tone: "ok" | "bad" = "ok") {
  const accent = tone === "ok" ? "#111" : "#9a3324";
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <meta name="robots" content="noindex">
     <title>${title}</title></head>
     <body style="margin:0;background:#fff;color:#111;font:16px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif">
       <div style="max-width:520px;margin:14vh auto;padding:0 28px">
         <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#666;margin-bottom:18px">Loutakis Real Estate</div>
         <h1 style="font-size:26px;font-weight:600;margin:0 0 12px;color:${accent}">${title}</h1>
         <p style="color:#555;margin:0">${body}</p>
       </div>
     </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(req: Request) {
  if (!tokensConfigured()) {
    return page(
      "Not configured",
      "PORTAL_TOKEN_SECRET isn't set on this deployment, so approval links can't be verified.",
      "bad"
    );
  }

  const token = new URL(req.url).searchParams.get("t") ?? "";
  const payload = verifyToken(token);

  if (!payload) {
    return page(
      "This link isn't valid",
      "It may have expired, or been altered. Approve the request from Box &amp; Dice instead, or ask them to register again.",
      "bad"
    );
  }

  try {
    if (payload.a === "approve") {
      const { name, email } = await approveBuyer(payload.c);
      return page(
        "Approved",
        `${name} now has access to the off-market list${
          email ? `, and has been emailed a link` : ""
        }. Their contact in Box &amp; Dice is marked <strong>Off Market List</strong>.`
      );
    }

    const { name } = await declineBuyer(payload.c);
    return page(
      "Declined",
      `${name} hasn't been given access, and hasn't been emailed. Their contact stays in Box &amp; Dice with a note.`
    );
  } catch (err) {
    console.error("[portal] approve/decline failed", err);
    return page(
      "Something went wrong",
      "The request couldn't be completed. Nothing has changed — try the link again, or set the category in Box &amp; Dice by hand.",
      "bad"
    );
  }
}
