"use client";

import { useEffect, useState } from "react";
import Logo from "@/components/Logo";

export type Marker = { id: string; label: string };

/**
 * The vendor page's own chrome. Wordmark, the address, the chapters as a row
 * of markers that light up as the vendor scrolls, and Approve always within
 * reach. Nothing here leads away from the page.
 */
export default function VendorFrame({
  address,
  markers,
  approved,
}: {
  address: string;
  markers: Marker[];
  approved: boolean;
}) {
  const [active, setActive] = useState<string>(markers[0]?.id ?? "");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const els = markers.map((m) => document.getElementById(m.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    // Whichever chapter crosses the upper third of the screen is "current".
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    els.forEach((el) => io.observe(el));
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [markers]);

  const jump = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <header className={scrolled ? "vf vf-scrolled" : "vf"}>
        <div className="vf-inner">
          <div className="vf-brand">
            <Logo height={14} variant="black" />
            <span className="vf-addr">{address}</span>
          </div>
          <nav className="vf-nav" aria-label="Sections">
            {markers.map((m) => (
              <a key={m.id} href={`#${m.id}`} onClick={jump(m.id)} className={active === m.id ? "on" : undefined}>
                {m.label}
              </a>
            ))}
          </nav>
          <a href="#approve" onClick={jump("approve")} className={approved ? "vf-cta done" : "vf-cta"}>
            {approved ? "Approved" : "Approve"}
          </a>
        </div>
      </header>

      {/* Phone: markers become a slim bar along the bottom. */}
      <nav className="vf-bottom" aria-label="Sections">
        {markers.map((m) => (
          <a key={m.id} href={`#${m.id}`} onClick={jump(m.id)} className={active === m.id ? "on" : undefined}>
            <i />
            <span>{m.label}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
