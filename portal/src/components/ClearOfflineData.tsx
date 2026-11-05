"use client";

import { useEffect } from "react";

/** Shown to signed-out visitors: forget card pages kept for offline use on this phone. */
export function ClearOfflineData() {
  useEffect(() => {
    navigator.serviceWorker?.controller?.postMessage("clear");
    if ("caches" in window) void caches.delete("ttp-pages-v1");
  }, []);
  return null;
}
