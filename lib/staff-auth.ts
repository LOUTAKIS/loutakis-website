import "server-only";
import { cookies } from "next/headers";
import { createToken, verifyToken } from "./portal-token";
import { sendMail, esc } from "./mail";

/**
 * Staff sign-in for the vendor approval tools.
 *
 * Emailed links to an allowlist of addresses (STAFF_EMAILS, comma-separated).
 * Same mechanism as the buyer portal, restricted to the people who send vendor
 * pages — chosen over Microsoft sign-in because it reuses tested code and
 * identifies the sender just as well, at a team of three.
 *
 * Add someone: append their address to STAFF_EMAILS in Vercel. Remove someone:
 * take it out. Sessions last a week and are re-checked against the list on
 * every request, so removal takes effect on their next click.
 */

const COOKIE = "lre_staff";
const SESSION_DAYS = 7;

export function staffAllowlist(): string[] {
  return String(process.env.STAFF_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes("@"));
}

export function isStaff(email: string): boolean {
  return staffAllowlist().includes(String(email ?? "").trim().toLowerCase());
}

/** First part of the address, capitalised — "michael" → "Michael". Good enough for "sent by". */
export function staffDisplayName(email: string): string {
  const local = email.split("@")[0] ?? "";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://loutakis-website.vercel.app").replace(/\/$/, "");
}

/** Email a 15-minute sign-in link. Silent if the address isn't on the list. */
export async function sendStaffSignIn(email: string): Promise<void> {
  const addr = String(email ?? "").trim().toLowerCase();
  if (!isStaff(addr)) return; // never reveal who's on the list

  const token = createToken("staff-signin", addr, 15 / 1440); // 15 minutes
  const link = `${siteUrl()}/api/staff/session?t=${token}`;

  await sendMail({
    to: [addr],
    subject: "Sign in to Loutakis vendor approvals",
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111;line-height:1.55">
        <p>Hi ${esc(staffDisplayName(addr))},</p>
        <p style="margin:24px 0">
          <a href="${link}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 28px;font-size:13px;letter-spacing:.12em;text-transform:uppercase">Sign in</a>
        </p>
        <p style="color:#666">This link works for fifteen minutes and signs you in for a week. If you didn't ask for it, ignore this email.</p>
      </div>
    `,
  });
}

export function setStaffSession(email: string) {
  const token = createToken("staff-session", email.toLowerCase(), SESSION_DAYS);
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export function clearStaffSession() {
  cookies().set(COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export type Staff = { email: string; name: string };

/** The signed-in staff member, or null. Re-checks the allowlist every time. */
export function getStaff(): Staff | null {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.a !== "staff-session") return null;
  const email = String(payload.c).toLowerCase();
  if (!isStaff(email)) return null;
  return { email, name: staffDisplayName(email) };
}
