import Logo from "./Logo";

export default function SiteFooter() {
  return (
    <footer className="site">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <div style={{ marginBottom: 18 }}>
              <Logo height={24} variant="white" />
            </div>
            <p style={{ maxWidth: 340 }}>
              Boutique real estate for Melbourne&apos;s Inner West. It&apos;s time to move.
            </p>
            <p style={{ marginTop: 14, letterSpacing: ".06em" }}>
              <a href="https://www.instagram.com/loutakisrealestate/">Instagram</a>{"  ·  "}
              <a href="https://www.youtube.com/@LoutakisRealEstate">YouTube</a>{"  ·  "}
              <a href="https://www.realestate.com.au/agency/loutakis-real-estate-YGFUOB">realestate.com.au</a>
            </p>
          </div>
          <div>
            <h4>Hours</h4>
            <p>Mon–Sat · 9am–6pm<br />Sun · 10am–3pm</p>
          </div>
          <div>
            <h4>Contact</h4>
            <p>
              62a Williamstown Road,<br />Kingsville VIC 3012<br /><br />
              <a href="mailto:michael@loutakis.com.au">michael@loutakis.com.au</a><br />
              +61 409 438 025
            </p>
          </div>
        </div>
        <div className="copy">
          <span>© {new Date().getFullYear()} Loutakis Real Estate Pty Ltd.</span>
          <span>It&rsquo;s time to move.</span>
        </div>
      </div>
    </footer>
  );
}
