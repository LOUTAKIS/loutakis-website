import Link from "next/link";
import { getStaff } from "@/lib/staff-auth";
import { getReaStats, daysSinceChecked, STALE_AFTER_DAYS, REA_PROFILE } from "@/lib/rea-stats";
import { getSalesStats } from "@/lib/sales-stats";
import MarketStatsForm from "@/components/MarketStatsForm";

export const metadata = {
  title: "Market performance — Loutakis Real Estate",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function MarketStatsPage() {
  const staff = getStaff();
  if (!staff) {
    return (
      <section className="portal-page">
        <div className="wrap" style={{ maxWidth: 520 }}>
          <div className="eyebrow">Staff</div>
          <h2>Market performance</h2>
          <p className="portal-intro">
            <Link href="/staff">Sign in</Link> to update these figures.
          </p>
        </div>
      </section>
    );
  }

  const [current, ours] = await Promise.all([getReaStats(), getSalesStats(12)]);
  const age = daysSinceChecked(current);
  const stale = age !== null && age > STALE_AFTER_DAYS;

  return (
    <section className="portal-page">
      <div className="wrap" style={{ maxWidth: 860 }}>
        <div className="section-head">
          <div>
            <div className="eyebrow">Staff · {staff.name}</div>
            <h2>Market performance</h2>
          </div>
          <Link href="/staff" className="btn">Back</Link>
        </div>

        <p className="portal-intro">
          These are the figures shown on{" "}
          <Link href="/sell-with-us">Sell with us</Link>. They come from{" "}
          <a href={REA_PROFILE} target="_blank" rel="noopener noreferrer">
            our REA agency profile
          </a>{" "}
          rather than being calculated here, so they always match what a vendor
          sees when they check. Open REA, copy the three rows across, set the
          date, and save.
        </p>

        {/* Age is the whole risk with a hand-entered number, so it is stated
            before the form rather than buried under it. */}
        {current ? (
          <p className={`ms-age ${stale ? "bad" : ""}`}>
            {age === 0
              ? "Read today."
              : `Last read ${age} day${age === 1 ? "" : "s"} ago${
                  current.checkedBy ? ` by ${current.checkedBy.split("@")[0]}` : ""
                }.`}
            {stale && ` Worth re-reading — anything older than ${STALE_AFTER_DAYS} days is probably out of date.`}
            {!current.published && " Not published yet."}
          </p>
        ) : (
          <p className="ms-age">Nothing saved yet — the section stays hidden until it is.</p>
        )}

        <MarketStatsForm
          current={current}
          ours={
            ours
              ? {
                  totalSold: ours.totalSold,
                  medianPrice: ours.medianPrice,
                  byType: ours.byType.map((t) => ({
                    type: t.type,
                    sold: t.sold,
                    medianPrice: t.medianPrice,
                  })),
                }
              : null
          }
        />
      </div>
    </section>
  );
}
