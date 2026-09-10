"use client";

import { useEffect } from "react";

/**
 * Tells the server a member opened this page.
 *
 * It knows nothing about who is looking — it posts what was opened, and the
 * server attributes it to a signed-in member or throws it away. So this can
 * sit on a public property page without that page learning anything about its
 * visitor, and someone who has never signed in leaves no trace anywhere.
 *
 * `keepalive` so the request survives the page being closed straight after,
 * and it never surfaces an error: a log line is not worth a broken page.
 */
export default function ActivityBeacon({
  kind,
  listingId,
}: {
  kind: "list" | "view";
  listingId?: string;
}) {
  useEffect(() => {
    fetch("/api/portal/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, listingId }),
      keepalive: true,
    }).catch(() => {});
  }, [kind, listingId]);

  return null;
}
