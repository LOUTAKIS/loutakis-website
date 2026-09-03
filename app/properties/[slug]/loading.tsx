/**
 * Shown the instant a listing is clicked.
 *
 * These pages render on demand, so a cold cache means waiting on Box & Dice —
 * a few seconds, and longer while the API is throttling. Without this, Next
 * paints nothing until the server answers and the click feels broken.
 */
export default function Loading() {
  return (
    <section className="detail">
      <div className="wrap">
        <div className="sk sk-hero" />
        <div className="detail-grid" style={{ marginTop: 40 }}>
          <div>
            <div className="sk sk-line" style={{ width: "60%", height: 34 }} />
            <div className="sk sk-line" style={{ width: "35%" }} />
            <div className="sk sk-line" style={{ width: "90%", marginTop: 28 }} />
            <div className="sk sk-line" style={{ width: "85%" }} />
            <div className="sk sk-line" style={{ width: "70%" }} />
          </div>
          <div>
            <div className="sk sk-line" style={{ width: "50%", height: 20 }} />
            <div className="sk sk-line" style={{ width: "80%" }} />
          </div>
        </div>
        <span className="sr-only">Loading property…</span>
      </div>
    </section>
  );
}
