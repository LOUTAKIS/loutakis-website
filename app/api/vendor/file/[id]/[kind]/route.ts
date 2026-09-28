import { getCampaign } from "@/lib/campaigns";
import { downloadFile } from "@/lib/sharepoint";
import { resolveCampaignFile, type FileKind } from "@/lib/vendor-files";
import { verifyToken } from "@/lib/portal-token";
import { getStaff } from "@/lib/staff-auth";
import { isUnlocked, getDemoCampaignId } from "@/lib/demo-approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streams the board or brochure for a campaign.
 *
 * SharePoint is never exposed: the vendor's browser asks us, we ask Graph with
 * the app credential, and the bytes pass through. Access is the vendor's own
 * link token or a staff session — the URL alone gets nothing.
 *
 * Which file to send is resolved by lib/vendor-files.ts, the same code that
 * checks a campaign before its link is emailed. One resolver for both, so the
 * check and the serve can never disagree about whether a campaign is ready.
 *
 * NOTHING IN HERE MAY THROW. This is the artwork on the page we ask a vendor to
 * authorise money against; a 500 there is worse than an honest failure, because
 * it looks like the whole site is broken rather than one file being missing.
 * The handler is wrapped, and the one thing that got through the first time —
 * the filename — is encoded rather than trusted. See asciiName().
 */

/**
 * A filename safe to put in a header, and the UTF-8 one beside it.
 *
 * THIS IS WHAT TURNED A 502 INTO A 500. Headers are ByteStrings: `set()` throws
 * a TypeError on any character above U+00FF, and real filenames coming back
 * from SharePoint are full of en dashes and curly apostrophes. The recovery
 * had worked, found the file and got its true name — and then the response
 * crashed on the name.
 *
 * So the quoted form is stripped to plain ASCII for the browsers that only read
 * that, and `filename*` carries the real name percent-encoded per RFC 5987 for
 * everything else. A name that survives neither becomes the kind of file it is
 * plus its extension — "board.png" beats the ".png" that a purely non-ASCII
 * name would otherwise strip down to.
 */
function contentDisposition(name: string, fallback: string): string {
  const raw = String(name ?? "");
  const stripped = raw
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["\\]/g, "")
    .trim();

  // Punctuation and an extension is not a name. Keep the extension, which is
  // what tells the browser and the person what they are looking at.
  const hasSubstance = /[A-Za-z0-9]/.test(stripped.replace(/\.[A-Za-z0-9]+$/, ""));
  const ext = (raw.match(/\.[A-Za-z0-9]{1,8}$/) ?? [""])[0];
  const ascii = hasSubstance ? stripped : `${fallback}${ext}`;

  const utf8 = encodeURIComponent(raw || ascii);
  return `inline; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
export async function GET(req: Request, { params }: { params: { id: string; kind: string } }) {
  try {
    return await serve(req, params);
  } catch (err) {
    // The last line of defence. Whatever it was, the vendor gets a missing
    // image rather than a page that says the site is broken.
    console.error("[vendor file] unhandled", err);
    return new Response("Unavailable", { status: 502 });
  }
}

async function serve(req: Request, params: { id: string; kind: string }) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const payload = verifyToken(token);
  // The token's subject is "<campaign id>:<vendor index>" — any vendor's link
  // may read the files for their own campaign.
  const vendorOk = payload?.a === "vendor" && String(payload.c).split(":")[0] === params.id;
  const staffOk = Boolean(getStaff());
  /**
   * The password-protected example at /marketingapproval. Only ever the ONE
   * campaign staff nominated, and only for somebody who has the password —
   * the board and brochure are already public marketing, but that is no reason
   * to serve every campaign's artwork to anyone who guesses an id.
   */
  const demoOk = isUnlocked() && (await getDemoCampaignId()) === params.id;
  if (!vendorOk && !staffOk && !demoOk) return new Response("Not found", { status: 404 });

  if (params.kind !== "board" && params.kind !== "brochure") {
    return new Response("Not found", { status: 404 });
  }
  const kind = params.kind as FileKind;

  const c = await getCampaign(params.id);
  if (!c) return new Response("Not found", { status: 404 });

  const resolved = await resolveCampaignFile(c, kind);
  if (!resolved.ok) {
    console.error(`[vendor file] ${kind} unavailable: ${resolved.reason}`);
    return new Response("Unavailable", { status: 502 });
  }
  if (!resolved.id) return new Response("Not found", { status: 404 });

  let upstream: Response;
  try {
    upstream = await downloadFile(resolved.id);
  } catch (err) {
    console.error(`[vendor file] ${kind} download failed after resolving`, err);
    return new Response("Unavailable", { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream");
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  headers.set("Content-Disposition", contentDisposition(resolved.name, kind));
  /**
   * Not cached at all while a file has just been healed — a stale 5-minute
   * copy of a broken response is exactly what would make this look unfixed.
   */
  headers.set("Cache-Control", resolved.healed ? "no-store" : "private, max-age=300");
  headers.set("X-Robots-Tag", "noindex");
  return new Response(upstream.body, { status: 200, headers });
}
