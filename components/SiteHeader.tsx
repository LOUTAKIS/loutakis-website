import Link from "next/link";
import Logo from "./Logo";

export default function SiteHeader() {
  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <Link href="/" aria-label="Loutakis Real Estate — home">
          <Logo height={18} variant="black" />
        </Link>
        <nav className="nav-links">
          <Link href="/services">Services</Link>
          <Link href="/properties">Properties</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </div>
    </header>
  );
}
