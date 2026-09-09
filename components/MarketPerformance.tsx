import { getReaStats, REA_PROFILE } from "@/lib/rea-stats";
import { shortPrice } from "@/lib/sales-stats";

/**
 * Our market performance, on the Sell with us page.
 *
 * A vendor deciding between agents wants three things: how much you sell, what
 * you sell it for, and how long it takes. This is the whole argument for
 * listing with Loutakis, in nine numbers.
 *
 * Renders NOTHING until someone has read the figures off REA and marked them
 * published. An empty section is invisible; a performance claim nobody has
 * checked is a liability — these are the numbers the Australian Consumer Law
 * expects an agent to be able to substantiate on demand, and the attribution
 * and date below are how we do that.
 */
export default async function MarketPerformance() {
  const rea = await getReaStats();
  if (!rea?.published || !rea.rows?.length) return null;

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
            {rea.totalSold} properties sold in the last 12 months, at a median of{" "}
            {shortPrice(rea.medianPrice)}.
          </h2>
        </div>

        {/* A table, because it is a table: three measures across three kinds of
            home, and a vendor reads down the column that is theirs. */}
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
              {rea.rows.map((r) => (
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
          Figures for the last 12 months as published on{" "}
          <a href={REA_PROFILE} target="_blank" rel="noopener noreferrer">
            realestate.com.au
          </a>
          {checkedLabel ? `, read on ${checkedLabel}` : ""}.
        </p>
      </div>
    </section>
  );
}
