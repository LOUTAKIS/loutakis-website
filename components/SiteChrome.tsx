"use client";

import { usePathname } from "next/navigation";

/**
 * Wraps every page in the public header and footer — except the vendor
 * approval pages, which carry their own quiet frame. A vendor mid-approval
 * shouldn't be offered Services / Properties / Off-market to wander off to.
 */
export default function SiteChrome({
  header,
  footer,
  children,
}: {
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const bare = pathname.startsWith("/approve/");
  /**
   * The header wordmark and the footer must start on the same left margin as
   * the page's own content, and end on the same right margin. Since a page can
   * widen its container (the listings grid does), the width belongs to the
   * whole layout, not to the page: `wide` sets it for header, content and
   * footer at once. Add a route here if it needs the wider container.
   */
  const wide = pathname === "/properties";
  return (
    <div className={wide ? "layout wide" : "layout"}>
      {!bare && header}
      <main>{children}</main>
      {!bare && footer}
    </div>
  );
}
