/**
 * The property's address in the opening, street over suburb.
 *
 * Left to itself the heading wraps wherever the line runs out — "19 William /
 * Street, Newport" — which breaks the street name in half and hangs the suburb
 * off the end of it. The address has an obvious shape, so it is set rather than
 * left to chance: the street on the first line, the suburb on the second,
 * always. On a narrow screen a long street may still wrap within its own line,
 * which is the right thing to give way.
 */
export default function Address({ address }: { address: string }) {
  const raw = String(address ?? "").trim();
  const at = raw.indexOf(",");
  if (at < 0) return <>{raw}</>;

  const street = raw.slice(0, at).trim();
  // Everything after the first comma is where it is — suburb, and whatever
  // else a record carries.
  const rest = raw.slice(at + 1).trim();
  if (!street || !rest) return <>{raw}</>;

  return (
    <>
      <span className="vaddr-street">{street}</span>
      <span className="vaddr-suburb">{rest}</span>
    </>
  );
}
