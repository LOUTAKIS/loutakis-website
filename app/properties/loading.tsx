/** Same reasoning as the listing page: instant feedback while the CRM answers. */
export default function Loading() {
  return (
    <section className="properties-page">
      <div className="wrap">
        <div className="eyebrow">Properties</div>
        <div className="sk sk-line" style={{ width: 280, height: 40, marginBottom: 40 }} />
        <div className="grid">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div className="sk sk-card" />
              <div className="sk sk-line" style={{ width: "75%", marginTop: 18 }} />
              <div className="sk sk-line" style={{ width: "40%" }} />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading properties…</span>
      </div>
    </section>
  );
}
