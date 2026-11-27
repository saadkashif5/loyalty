"use client";

import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "ttp-install-dismissed";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

type PwaMessages = Record<
  "pwa.offline" | "pwa.installAndroid" | "pwa.installIos" | "pwa.add" | "pwa.notNow",
  string
>;

/**
 * Registers the offline helper, offers to add the portal to the home screen
 * (Android's own prompt, or the steps on iPhone), and says so when offline.
 */
export function Pwa({ messages }: { messages: PwaMessages }) {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [iosTip, setIosTip] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone && !wasDismissed() && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setIosTip(true);
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      if (!wasDismissed()) setInstallEvent(event as InstallPromptEvent);
    };
    const onConnection = () => setOffline(!navigator.onLine);
    onConnection();
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("online", onConnection);
    window.addEventListener("offline", onConnection);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("online", onConnection);
      window.removeEventListener("offline", onConnection);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Private browsing: the offer simply comes back next time.
    }
    setInstallEvent(null);
    setIosTip(false);
  };

  return (
    <div className="space-y-2 px-5">
      {offline ? (
        <p className="rounded-xl bg-accent-50 px-4 py-2 text-sm text-accent-900">
          {messages["pwa.offline"]}
        </p>
      ) : null}
      {installEvent || iosTip ? (
        <div className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm">
          <p className="flex-1">
            {installEvent ? messages["pwa.installAndroid"] : messages["pwa.installIos"]}
          </p>
          {installEvent ? (
            <button
              type="button"
              className="rounded-2xl bg-brand-600 px-3 py-1.5 font-medium text-white"
              onClick={async () => {
                await installEvent.prompt();
                await installEvent.userChoice.catch(() => undefined);
                setInstallEvent(null);
              }}
            >
              {messages["pwa.add"]}
            </button>
          ) : null}
          <button
            type="button"
            className="text-ink-500"
            onClick={dismiss}
            aria-label={messages["pwa.notNow"]}
          >
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}
