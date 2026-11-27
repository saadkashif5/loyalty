"use client";

import { useEffect, useState } from "react";

interface NdefRecord {
  recordType: string;
  data?: DataView;
}
interface NdefReadingEvent extends Event {
  message: { records: NdefRecord[] };
}
interface NdefReaderLike extends EventTarget {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
}

/** The stamper link inside a tag's records, if it is one of ours. */
function stamperLink(records: NdefRecord[]): string | null {
  for (const record of records) {
    if (record.recordType !== "url" || !record.data) continue;
    const text = new TextDecoder().decode(record.data);
    try {
      const url = new URL(text, window.location.origin);
      if (/^\/t\/[^/]+$/.test(url.pathname)) return `${url.pathname}${url.search}`;
    } catch {
      // Not a URL: some other tag.
    }
  }
  return null;
}

type NfcMessages = Record<
  "nfc.button" | "nfc.listening" | "nfc.notOurs" | "nfc.readError" | "nfc.off",
  string
>;

/**
 * Reads a stamper from inside the page on Android Chrome (Web NFC), for
 * phones whose system does not open the tag's link by itself. Shown only
 * where the browser supports it.
 */
export function WebNfcTap({ messages }: { messages: NfcMessages }) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<"idle" | "listening" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSupported("NDEFReader" in window);
  }, []);

  if (!supported) return null;

  const listen = async () => {
    const Reader = (window as unknown as { NDEFReader: new () => NdefReaderLike }).NDEFReader;
    const reader = new Reader();
    const stop = new AbortController();
    setState("listening");
    setMessage(null);
    try {
      await reader.scan({ signal: stop.signal });
      reader.addEventListener("reading", (event) => {
        const link = stamperLink((event as NdefReadingEvent).message.records);
        if (link) {
          stop.abort();
          window.location.assign(link);
        } else {
          setMessage(messages["nfc.notOurs"]);
        }
      });
      reader.addEventListener("readingerror", () => setMessage(messages["nfc.readError"]));
      // Stop listening after a minute so the radio is not left on.
      setTimeout(() => {
        stop.abort();
        setState("idle");
      }, 60_000);
    } catch {
      setState("error");
      setMessage(messages["nfc.off"]);
    }
  };

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 text-center text-sm">
      {state === "listening" ? (
        <p className="font-medium text-brand-600">{messages["nfc.listening"]}</p>
      ) : (
        <button
          type="button"
          onClick={listen}
          className="w-full rounded-2xl bg-brand-600 py-2.5 font-medium text-white"
        >
          {messages["nfc.button"]}
        </button>
      )}
      {message ? <p className="mt-2 text-ink-600">{message}</p> : null}
    </div>
  );
}
