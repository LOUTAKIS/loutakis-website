import "server-only";
import { getContact, CATEGORY_APPROVED, CATEGORY_PENDING } from "./portal";
import { listRegisteredContacts, listOptedOut, getRegisteredEmail } from "./portal-store";

/**
 * Everyone who registered for the off-market list through this website, and
 * where each of them stands.
 *
 * WHY IT IS BUILT THIS WAY. There is no "list contacts in a category" call in
 * the Website API — the contacts collection takes no category filter — so the
 * only honest source for "who is on the list" is the ids we wrote ourselves at
 * registration, read back one contact at a time.
 *
 * Status comes from the CRM CATEGORY, not from our store, for the same reason
 * the portal decides access that way: remove someone's category in Box & Dice
 * and this page must show them gone on the next load. Our store is the roll of
 * who to ask about; the CRM is the answer.
 */

export type Member = {
  contactId: number;
  name: string;
  email: string;
  mobile: string;
  status: "approved" | "pending" | "none";
  /** They asked to stop the new-listing emails. Access is unaffected. */
  optedOut: boolean;
};

/**
 * Box & Dice rate-limits per endpoint, so these go out a few at a time rather
 * than all at once — thirty parallel reads is how you turn a members page into
 * a 429. Small enough to stay polite, big enough that the page isn't slow.
 */
const BATCH = 4;

/** A hard stop, so this can never become a hundred CRM reads on one page view. */
const MAX = 200;

export async function listMembers(): Promise<Member[]> {
  const [ids, optedOut] = await Promise.all([listRegisteredContacts(), listOptedOut()]);
  const wanted = ids.slice(0, MAX);
  const out: Member[] = [];

  for (let i = 0; i < wanted.length; i += BATCH) {
    const slice = wanted.slice(i, i + BATCH);
    const rows = await Promise.all(
      slice.map(async (contactId): Promise<Member | null> => {
        try {
          const c = await getContact(contactId);
          const names = (c?.categories ?? []).map((x: any) => String(x?.name ?? x));
          const status: Member["status"] = names.includes(CATEGORY_APPROVED)
            ? "approved"
            : names.includes(CATEGORY_PENDING)
              ? "pending"
              : "none";

          /**
           * The address they registered with, ahead of the CRM primary — the
           * primary can be an old work address on a contact matched by name
           * and mobile, and it is the registered one we actually email.
           */
          const registered = await getRegisteredEmail(contactId).catch(() => null);

          return {
            contactId: Number(contactId),
            name: [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim() || `Contact ${contactId}`,
            email: registered || String(c?.email ?? "").trim(),
            mobile: String(c?.mobile ?? "").trim(),
            status,
            optedOut: optedOut.includes(Number(contactId)),
          };
        } catch (err) {
          // One unreadable contact must not empty the whole page.
          console.error(`[members] contact ${contactId} unreadable`, err);
          return null;
        }
      })
    );
    for (const r of rows) if (r) out.push(r);
  }

  // Waiting first — they are the ones needing a decision — then by name.
  const rank = { pending: 0, approved: 1, none: 2 } as const;
  return out.sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name));
}
