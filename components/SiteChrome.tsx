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
  return (
    <>
      {!bare && header}
      <main>{children}</main>
      {!bare && footer}
    </>
  );
}
