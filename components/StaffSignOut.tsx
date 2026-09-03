"use client";

import { useRouter } from "next/navigation";

export default function StaffSignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="link-btn"
      onClick={async () => {
        await fetch("/api/staff/session", { method: "DELETE" });
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
