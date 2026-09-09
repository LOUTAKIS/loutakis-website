import { getOffMarketCount } from "@/lib/boxdice";

/**
 * "Three properties are on the private list right now."
 *
 * The one honest reason to register, said before the form. A sign-in wall with
 * nothing visible behind it is just a wall — this is the only thing we can put
 * in front of someone that both tells the truth and is worth their two minutes.
 *
 * NOTHING BUT THE NUMBER. No address, no suburb, no size, no price. A vendor
 * on this list chose a quiet campaign, and a count identifies nobody.
 *
 * Silent at zero, and silent if the CRM is unreachable. "Nothing available"
 * on a sign-in page talks a buyer out of registering — and the list is empty
 * only until the next tag is set, at which point they would already be in.
 */
export default async function OffMarketCount({ className }: { className?: string }) {
  let count = 0;
  try {
    count = await getOffMarketCount();
  } catch (err) {
    console.error("[off-market count] unavailable", err);
    return null;
  }
  if (count < 1) return null;

  // Spelled out to ten: it reads as a sentence, not a statistic, which is the
  // register at which the rest of this page speaks.
  const WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  const n = count <= 10 ? WORDS[count] : String(count);

  return (
    <p className={className}>
      <strong>
        {n} {count === 1 ? "property is" : "properties are"} on the private list right now.
      </strong>
    </p>
  );
}
