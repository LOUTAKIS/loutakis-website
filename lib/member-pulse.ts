import "server-only";
import { listRegisteredContacts } from "./portal-store";
import { getActivity } from "./portal-activity";
import { getContact } from "./portal";

/**
 * Which off-market members are still with you, and which have gone quiet.
 *
 * THE ONLY THING ON THE WEBSITE PAGE THAT PRODUCES A PHONE CALL. Every other
 * figure there describes what happened; this one names a person who registered,
 * was approved, and has not been back in a month. That is a buyer going cold
 * while their details sit in the CRM looking like an asset.
 *
 * Built from our own activity store, which only ever sees SIGNED-IN members.
 * A registered buyer who browses the public site without signing in is
 * invisible here, correctly: the page is about the private list, and nobody
 * anonymous is identified anywhere in this system.
 */

const DAY = 86_400_000;

export type Pulse = {
  contactId: number;
  name: string;
  lastSeen: number | null;
  signIns30d: number;
  viewed: number;
  enquiries: number;
};

export type MemberPulse = {
  /** Signed in within the last seven days. */
  active: Pulse[];
  /** Nothing for a month or more, including those who have never been back. */
  quiet: Pulse[];
  total: number;
  /** True when the activity store has nothing yet — new, not broken. */
  empty: boolean;
};

/**
 * Names come from the CRM, a few at a time.
 *
 * Box & Dice rate-limits per endpoint, and a page that fires thirty parallel
 * contact reads is how you turn a dashboard into a 429. The cap is deliberate:
 * this is a summary, and a hundred members would be a different design.
 */
const BATCH = 4;
const MAX = 60;

export async function memberPulse(): Promise<MemberPulse> {
  let ids: number[] = [];
  try {
    ids = (await listRegisteredContacts()).slice(0, MAX);
  } catch (err) {
    console.error("[member pulse] couldn't list members", err);
    return { active: [], quiet: [], total: 0, empty: true };
  }

  const rows: Pulse[] = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const got = await Promise.all(
      chunk.map(async (id) => {
        const [activity, contact] = await Promise.all([
          getActivity(id).catch(() => null),
          getContact(id).catch(() => null),
        ]);
        if (!activity) return null;
        const name =
          [contact?.first_name, contact?.last_name].filter(Boolean).join(" ").trim() ||
          `Contact ${id}`;
        return {
          contactId: Number(id),
          name,
          lastSeen: activity.lastSeen,
          signIns30d: activity.signIns30d,
          viewed: activity.viewed.length,
          enquiries: activity.enquiries.length,
        };
      })
    );
    for (const r of got) if (r) rows.push(r);
  }

  const now = Date.now();
  const active = rows
    .filter((r) => r.lastSeen !== null && now - r.lastSeen < 7 * DAY)
    .sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));

  /**
   * "Never seen" counts as quiet, not as a separate state. Somebody approved
   * three weeks ago who has never signed in is the same phone call as somebody
   * who stopped — and splitting them into two lists would bury both.
   */
  const quiet = rows
    .filter((r) => r.lastSeen === null || now - r.lastSeen >= 30 * DAY)
    .sort((a, b) => (a.lastSeen ?? 0) - (b.lastSeen ?? 0));

  return {
    active,
    quiet,
    total: rows.length,
    empty: rows.every((r) => r.lastSeen === null),
  };
}
