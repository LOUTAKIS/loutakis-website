"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const LINKS = [
  { href: "/services", label: "Services" },
  { href: "/properties", label: "Properties" },
  { href: "/portal", label: "Off-market" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

/**
 * Mobile navigation. The desktop links are hidden below 760px, and until now
 * nothing replaced them — phones had no way to reach any page but the one they
 * landed on.
 */
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // The panel is portalled to <body>, so it can only render once we're on the
  // client and document.body exists.
  useEffect(() => setMounted(true), []);

  // Close on navigation, so tapping a link doesn't leave the panel over the page.
  useEffect(() => setOpen(false), [pathname]);

  // Hold the page still behind the panel, and let Escape out.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        className="nav-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav"
      >
        <span className={open ? "bar top open" : "bar top"} />
        <span className={open ? "bar bottom open" : "bar bottom"} />
      </button>

      {/*
        Portalled to <body> deliberately. The header sets backdrop-filter, and
        a filtered ancestor becomes the containing block for position:fixed
        descendants — so inside the header this panel was sized against the
        78px-tall bar instead of the viewport, and rendered as a see-through
        sliver with the links spilling over the page.
      */}
      {mounted &&
        createPortal(
          <div id="mobile-nav" className={open ? "mobile-nav open" : "mobile-nav"} hidden={!open}>
            <nav>
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={pathname === l.href ? "current" : undefined}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="mobile-nav-foot">
              <a href="tel:0409438025">0409 438 025</a>
              <a href="mailto:michael@loutakis.com.au">michael@loutakis.com.au</a>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
