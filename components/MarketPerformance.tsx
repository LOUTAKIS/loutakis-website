import { getSalesStats, shortPrice } from "@/lib/sales-stats";
import { getReaDays, REA_PROFILE } from "@/lib/rea-stats";

/**
 * Our market performance, on the Sell with us page.
 *
 * A vendor choosing between agents wants three things: how much you sell, what
 * you sell it for, and how long it takes. This is that argument, in nine
 * numbers.
 *
 * Sold counts and median prices are computed from our own CRM and update
 * themselves — and they reproduce realestate.com.au's card exactly, which is
 * the point: a vendor who checks both sees the same figures.
 *
 * Days advertised is read off REA by hand, because the CRM has no advertising
 * start date to compute it from. The footnote says so; a performance claim we
 * cannot substantiate is not one worth making.
 *
 * The section renders only when both halves are present. Half a table of
 * figures is worse than none.
 */
export default async function MarketPerformance() {
  const [stats, rea] = await Promise.all([getSalesStats(12), getReaDays()]);
  if (!stats?.byType?.length || !rea?.published) return null;

  const rows = stats.byType
    .map((t) => ({ ...t, medianDays: rea.days?.[t.type] ?? null }))
    // Only the types REA reports days for; anything else has an empty column.
    .filter((r) => r.medianDays !== null);

  if (!rows.length) return null;

  const checked = new Date(rea.checkedOn);
  const checkedLabel = isNaN(+checked)
    ? ""
    : checked.toLocaleDateString("en-AU", {
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

        {/* A table, because it is one: three measures across three kinds of
            home, and a vendor reads the row that is theirs. */}
        <div className="mp-scroll">
          <table className="mp-table">
            <thead>
              <tr>
                <th scope="col">Property</th>
                <th scope="col">Sold</th>
                <th scope="col">Median price</th>
                <th scope="col">Median days advertised</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.type}>
                  <th scope="row">{r.type}</th>
                  <td>{r.sold}</td>
                  <td>{shortPrice(r.medianPrice)}</td>
                  <td>{r.medianDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mp-source">
          Sales and prices from our own records for the 12 months to{" "}
          {new Date().toLocaleDateString("en-AU", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "Australia/Melbourne",
          })}
          . Days advertised as published on{" "}
          <a href={REA_PROFILE} target="_blank" rel="noopener noreferrer">
            realestate.com.au
          </a>
          {checkedLabel ? `, read on ${checkedLabel}` : ""}.
        </p>
      </div>
    </section>
  );
}
