"use client";

import { useState } from "react";

/** Shows a link with a copy button, for sharing invitation links by hand (e.g. on WhatsApp). */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 break-all rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-700">
        {url}
      </code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="rounded-xl border border-ink-300 px-3 py-2 text-xs font-medium hover:bg-ink-50"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
