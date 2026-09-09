import { getSalesStats, price } from "@/lib/sales-stats";

/**
 * Our market performance, on the Sell with us page.
 *
 * A vendor choosing between agents wants to know how much you sell, what you
 * sell it for, and how long it takes. This is that argument, in numbers.
 *
 * EVERY FIGURE IS COMPUTED FROM BOX & DICE. Nothing is typed in, nothing goes
 * stale, and the counts and prices reproduce realestate.com.au's card exactly —
 * so a vendor who checks both sees the same thing.
 *
 * Days advertised comes from date_listed, which the CRM records as the day a
 * listing went online. Cross-checked against REA Ignite, that basis reproduces
 * their medians exactly — 20.5, 21 and 20 days. A property sold off-market has
 * no advertised period and shows a dash rather than a misleading zero.
 */
export default async function MarketPerformance() {
  const stats = await getSalesStats(12);
  if (!stats?.byType?.length || !stats.totalSold) return null;

  // Shown as soon as anything has been advertised. A type whose sales were all
  // off-market has no days to report and reads as a dash, not a gap.
  const showDays = stats.byType.some((t) => t.medianDays !== null);

  return (
    <section className="mp">
      <div className="wrap">
        <div className="mp-head">
          {/* No eyebrow. The sentence below already says what these numbers
              are, and a label above it only said it twice. */}
          <h2 className="lead">
            {stats.totalSold} properties sold in the last 12 months, at a median of{" "}
            {price(stats.medianPrice)}.
          </h2>
        </div>

        {/* A table, because it is one: the same measures across three kinds of
            home, and a vendor reads the row that is theirs. */}
        <div className="mp-scroll">
          <table className="mp-table">
            <thead>
              <tr>
                <th scope="col">Property</th>
                <th scope="col">Sold</th>
                <th scope="col">Median price</th>
                {showDays && <th scope="col">Median days advertised</th>}
              </tr>
            </thead>
            <tbody>
              {stats.byType.map((r) => (
                <tr key={r.type}>
                  <th scope="row">{r.type}</th>
                  <td>{r.sold}</td>
                  <td>{price(r.medianPrice)}</td>
                  {showDays && <td>{r.medianDays ?? "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
