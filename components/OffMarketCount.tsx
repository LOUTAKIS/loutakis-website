import { getOffMarketCount } from "@/lib/boxdice";
import { countPhrase } from "@/lib/off-market-copy";

/**
 * "Eleven homes are selling quietly right now."
 *
 * The one honest reason to register, said before the form. A sign-in wall with
 * nothing visible behind it is just a wall — this is the only thing we can put
 * in front of someone that both tells the truth and is worth their two minutes.
 *
 * IT IS ABOUT THE HOMES, NOT THE LIST. It used to read "11 are on it right
 * now", which arrived after the sentence had finished and pointed back at a
 * list the reader has never seen. "Selling quietly" says what off-market means
 * to someone who has never heard the word.
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

  return (
    <p className={className}>
      <strong>{countPhrase(count)}.</strong>
    </p>
  );
}
