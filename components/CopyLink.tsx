"use client";

import { useState } from "react";

/**
 * Copy a link to the clipboard, with the link itself shown.
 *
 * The URL is visible on purpose. A vendor's questionnaire link is the sort of
 * thing you end up reading down the phone or pasting into a text message, and a
 * button that copies something you cannot see is no use when the clipboard is
 * blocked — which it is, silently, on an insecure origin and in some browsers
 * without a user gesture. So the fallback is always on screen.
 */
export default function CopyLink({ url, label = "Copy link" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Left for them to select by hand — which is why it is printed below.
      setCopied(false);
    }
  }

  return (
    <div className="cl">
      <button type="button" className="btn" onClick={copy}>
        {copied ? "Copied" : label}
      </button>
      <code className="cl-url">{url}</code>
    </div>
  );
}
