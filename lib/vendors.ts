/**
 * Who a campaign's marketing goes to.
 *
 * Deliberately free of `server-only` and of any import: the review screen is a
 * client component and needs these helpers too, and pulling them out of
 * `campaigns.ts` would drag the Global Config client into the browser bundle.
 * They take a structural shape rather than the `Campaign` type for the same
 * reason — nothing here needs to know what else a campaign holds.
 */

/** One person who has to see the marketing. A property can have several. */
export type Vendor = { name: string; email: string };

type WithVendors = {
  vendors?: Vendor[];
  /** Superseded by `vendors` — campaigns saved before the change hold this. */
  vendorName?: string;
  vendorEmail?: string;
};

/**
 * The vendors on a campaign, whichever shape it was saved in. Old campaigns
 * hold a single name/email pair; new ones hold a list. Everything that emails,
 * validates or records an approval reads through here so neither shape has to
 * be handled twice.
 */
export function campaignVendors(c: WithVendors): Vendor[] {
  const list = (c.vendors ?? []).filter((v) => v && (v.name?.trim() || v.email?.trim()));
  if (list.length) return list.map((v) => ({ name: v.name ?? "", email: v.email ?? "" }));
  if (c.vendorName || c.vendorEmail) return [{ name: c.vendorName ?? "", email: c.vendorEmail ?? "" }];
  return [];
}

/** Every address the link should go to — deduplicated, lower case. */
export function vendorEmails(c: WithVendors): string[] {
  const seen = new Set<string>();
  for (const v of campaignVendors(c)) {
    const e = v.email.trim().toLowerCase();
    if (e) seen.add(e);
  }
  return [...seen];
}

/** "Anna" · "Anna and Peter" · "Anna, Peter and Sam" — for a greeting. */
export function vendorGreeting(c: WithVendors): string {
  const names = campaignVendors(c)
    .map((v) => v.name.trim().split(/\s+/)[0])
    .filter(Boolean);
  if (!names.length) return "there";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
