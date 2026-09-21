"use client";

import { useTransition } from "react";
import { revokeDeviceAction } from "@/app/actions/business";

// Revoking is irreversible for that stamper, so it asks first.
export function RevokeDeviceButton({
  businessId,
  deviceId,
  identifier,
}: {
  businessId: string;
  deviceId: string;
  identifier: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const confirmed = window.confirm(
          `Revoke stamper ${identifier}? It will stop issuing stamps immediately and cannot be reactivated.`,
        );
        if (!confirmed) return;
        startTransition(() => {
          void revokeDeviceAction(businessId, deviceId);
        });
      }}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? "Revoking…" : "Revoke"}
    </button>
  );
}
