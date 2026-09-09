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
        {/* One group on the right, so adding the account glyph doesn't push the
            links into the middle of the bar — space-between would otherwise
            spread three items instead of two. */}
        <div className="nav-right">
        <nav className="nav-links">
          <a href="/sell-with-us">Sell with us</a>
          <a href="/properties">Properties</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </nav>
        {/* The private list is behind a sign-in, so it belongs beside the nav
            as an account, not inside it as another page. /portal sends a
            signed-out visitor to the sign-in screen and a member straight to
            the list, so one glyph serves both. */}
        <a href="/portal" className="nav-account" aria-label="Sign in to the off-market list" title="Off-market — sign in">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true" focusable="false">
            <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4.8 20c0-3.7 3.2-5.8 7.2-5.8s7.2 2.1 7.2 5.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </a>
        <MobileNav />
        </div>
      </div>
    </header>
  );
}
