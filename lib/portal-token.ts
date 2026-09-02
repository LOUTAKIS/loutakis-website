import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, self-contained action links — so approving a buyer is one tap from a
 * phone with no login, and nothing has to be stored server-side.
 *
 * A token carries what it authorises and when it expires, signed with
 * PORTAL_TOKEN_SECRET. Anyone holding the link can perform that one action on
 * that one contact until it lapses, which is the point: the link goes to the
 * office inbox, not to the buyer.
 */

const SECRET = process.env.PORTAL_TOKEN_SECRET;

export type Action = "approve" | "decline";

type Payload = {
  a: Action;
  c: string; // contact id
  e: number; // expiry, unix seconds
};

const b64url = (b: Buffer) => b.toString("base64url");

function sign(data: string): string {
  if (!SECRET) throw new Error("PORTAL_TOKEN_SECRET is not set");
  return b64url(createHmac("sha256", SECRET).update(data).digest());
}

/** Default 30 days — long enough that a link still works after a holiday. */
export function createToken(action: Action, contactId: string | number, days = 30): string {
  const payload: Payload = {
    a: action,
    c: String(contactId),
    e: Math.floor(Date.now() / 1000) + days * 86400,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body)}`;
}

export function verifyToken(token: string): Payload | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  let expected: string;
  try {
    expected = sign(body);
  } catch {
    return null;
  }

  // Constant-time compare — a fast rejection leaks how much of the signature
  // was right, which is enough to forge one given patience.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload?.a || !payload?.c || !payload?.e) return null;
  if (payload.e < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

export function tokensConfigured(): boolean {
  return Boolean(SECRET);
}
