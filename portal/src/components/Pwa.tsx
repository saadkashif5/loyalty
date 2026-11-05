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

/**
 * Registers the offline helper, offers to add the portal to the home screen
 * (Android's own prompt, or the steps on iPhone), and says so when offline.
 */
export function Pwa() {
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
        <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-900">
          You are offline. This is your card as last loaded; new stamps appear when you are back
          online.
        </p>
      ) : null}
      {installEvent || iosTip ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <p className="flex-1">
            {installEvent
              ? "Add TapTapSell to your home screen to open your cards in one tap."
              : "Add TapTapSell to your home screen: tap Share, then Add to Home Screen."}
          </p>
          {installEvent ? (
            <button
              type="button"
              className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white"
              onClick={async () => {
                await installEvent.prompt();
                await installEvent.userChoice.catch(() => undefined);
                setInstallEvent(null);
              }}
            >
              Add
            </button>
          ) : null}
          <button type="button" className="text-slate-500" onClick={dismiss} aria-label="Not now">
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}
