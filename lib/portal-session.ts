import "server-only";
import { cookies } from "next/headers";
import { createToken, verifyToken } from "./portal-token";
import { getContact, CATEGORY_APPROVED, CATEGORY_PENDING } from "./portal";

/**
 * Who is signed in, and are they allowed in.
 *
 * The session is a signed cookie holding the contact id — nothing else. Every
 * page load re-reads the contact from Box & Dice, so access is decided by the
 * CRM category *right now*, not by whatever was true when they signed in.
 * Remove "Off Market List" from someone and they're out on their next click.
 */

const COOKIE = "lre_portal";

/** How long a device stays signed in. Michael chose 12 hours. */
export const SESSION_HOURS = 12;

export function setSession(contactId: string | number) {
  const token = createToken("session" as any, contactId, SESSION_HOURS / 24);
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export function clearSession() {
  cookies().set(COOKIE, "", { path: "/", maxAge: 0 });
}

export type Viewer = {
  contactId: string;
  firstName: string;
  status: "approved" | "pending" | "none";
};

/** The signed-in viewer, with their access decided live from the CRM. */
export async function getViewer(): Promise<Viewer | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload || (payload.a as string) !== "session") return null;

  let contact: any;
  try {
    contact = await getContact(payload.c);
  } catch {
    return null;
  }

  const names = (contact?.categories ?? []).map((c: any) => String(c?.name ?? c));
  const status: Viewer["status"] = names.includes(CATEGORY_APPROVED)
    ? "approved"
    : names.includes(CATEGORY_PENDING)
    ? "pending"
    : "none";

  return {
    contactId: String(contact?.id ?? payload.c),
    firstName: contact?.first_name || "",
    status,
  };
}
