/**
 * The copy, set like the page of a brochure. Nothing interactive: a vendor
 * who wants a word changed writes it in the amendments box at the end, and a
 * selection chip over the text was one mechanism too many for the job.
 */
export default function Copy({ heading, text }: { heading: string; text: string }) {
  return (
    <div className="vcopy">
      {heading && <h3>{heading}</h3>}
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
