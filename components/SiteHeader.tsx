import Logo from "./Logo";
import MobileNav from "./MobileNav";

/**
 * Plain anchors, not next/link. Client-side navigation from the header proved
 * unreliable on property pages — the click registered, the router did nothing,
 * and the visitor was stuck (7 Sep 2026). A full page load costs a moment and
 * always works; on a six-page site that is the right trade.
 */
export default function SiteHeader() {
  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <a href="/" aria-label="Loutakis Real Estate — home">
          <Logo height={18} variant="black" />
        </a>
        <nav className="nav-links">
          <a href="/services">Services</a>
          <a href="/properties">Properties</a>
          <a href="/portal">Off-market</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </nav>
        <MobileNav />
      </div>
    </header>
  );
}
