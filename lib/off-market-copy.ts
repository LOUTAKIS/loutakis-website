/**
 * "11 homes are selling quietly right now."
 *
 * One sentence, written once, used on the Properties card, the sign-in page
 * and the register page. It lives in its own file with no imports because the
 * card that uses it is a client component and everything else about the
 * off-market count is server-only — the phrasing is the only part of this that
 * both sides are allowed to share.
 *
 * IT IS ABOUT THE HOMES, NOT THE LIST. It used to read "11 are on it right
 * now", which arrived after the sentence had finished and pointed back at a
 * list the reader has never seen. "Selling quietly" says what off-market means
 * to someone who has never heard the word.
 */

/**
 * Digits, always — "3 homes", not "Three homes".
 *
 * Prose would spell it, but this is not prose: the number is the reason the
 * sentence exists, and a digit is what the eye stops on.
 */
export function countPhrase(n: number): string {
  return `${n} ${n === 1 ? "home is" : "homes are"} selling quietly right now`;
}
