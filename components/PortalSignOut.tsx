"use client";

import { useRouter } from "next/navigation";

/**
 * Sign out of the buyer portal.
 *
 * A signed-in account with no visible way out is the kind of thing people
 * notice on a shared computer, and this list is private enough that they
 * should be able to close it deliberately.
 */
export default function PortalSignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="link-btn"
      onClick={async () => {
        await fetch("/api/portal/session", { method: "DELETE" });
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
