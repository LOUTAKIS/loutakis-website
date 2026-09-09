import { getSalesStats, shortPrice } from "@/lib/sales-stats";

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
 * The days column appears on its own once the CRM holds real advertising-start
 * dates (see lib/sales-stats). Until then the table is three columns, because
 * a number we cannot stand behind is worse than a column that isn't there.
 */
export default async function MarketPerformance() {
  const stats = await getSalesStats(12);
  if (!stats?.byType?.length || !stats.totalSold) return null;

  // Only once every published type has one; a half-filled column reads as a gap.
  const showDays = stats.byType.every((t) => t.medianDays !== null);

  const asAt = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  });

  return (
    <section className="mp">
      <div className="wrap">
        <div className="mp-head">
          <div className="eyebrow">Our market performance</div>
          <h2 className="lead">
            {stats.totalSold} properties sold in the last 12 months, at a median of{" "}
            {shortPrice(stats.medianPrice)}.
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
                  <td>{shortPrice(r.medianPrice)}</td>
                  {showDays && <td>{r.medianDays}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mp-source">
          From our own sales records, for the 12 months to {asAt}.
        </p>
      </div>
    </section>
  );
}
