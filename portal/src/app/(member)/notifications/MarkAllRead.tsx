"use client";

import { useEffect } from "react";
import { markNotificationsReadAction } from "@/app/actions";

/** Opening the list counts as reading it; the dots stay until the next visit. */
export function MarkAllRead() {
  useEffect(() => {
    void markNotificationsReadAction();
  }, []);
  return null;
}
