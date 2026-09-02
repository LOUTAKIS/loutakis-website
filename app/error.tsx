"use client";

/**
 * Shown when a page fails to render — in practice, when Box & Dice is
 * unreachable and there's no cached page to fall back on. It says so plainly
 * and offers the phone, rather than inventing listings to fill the space.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="portal-page">
      <div className="wrap" style={{ maxWidth: 640 }}>
        <div className="eyebrow">Sorry</div>
        <h2>We couldn&rsquo;t load this just now</h2>
        <p className="portal-intro">
          Something went wrong at our end — it&rsquo;s usually brief. Try again in a moment, or call
          Michael on <a href="tel:0409438025">0409&nbsp;438&nbsp;025</a>.
        </p>
        <button className="btn" onClick={reset} style={{ marginTop: 8 }}>
          Try again
        </button>
      </div>
    </section>
  );
}
