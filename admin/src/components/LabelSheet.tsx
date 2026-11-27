"use client";

import { BRAND } from "@taptapsell/brand";

export interface Label {
  deviceIdentifier: string;
  qrDataUrl: string;
  activationCode?: string;
  business?: string | null;
  branch?: string | null;
}

/**
 * Cards to print and pack with each stamper: its ID, a QR code that opens
 * the dashboard's activation form, and the activation code when it is known
 * (only right after minting).
 */
export function LabelSheet({ labels }: { labels: Label[] }) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => window.print()}
        className="print-hidden rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm font-medium hover:bg-ink-50"
      >
        Print labels
      </button>
      <div className="print-area grid grid-cols-2 gap-3 sm:grid-cols-3">
        {labels.map((label) => (
          <div
            key={label.deviceIdentifier}
            className="flex break-inside-avoid items-center gap-3 rounded-2xl border border-ink-300 bg-white p-3"
          >
            <img src={label.qrDataUrl} alt="" width={96} height={96} />
            <div className="min-w-0 text-xs">
              <p className="font-semibold">{BRAND.name} stamper</p>
              <p className="font-mono text-sm">{label.deviceIdentifier}</p>
              {label.activationCode ? (
                <p className="mt-1">
                  Activation code: <span className="font-mono">{label.activationCode}</span>
                </p>
              ) : null}
              {label.business ? (
                <p className="mt-1 text-ink-500">
                  {label.business}
                  {label.branch ? ` · ${label.branch}` : ""}
                </p>
              ) : null}
              <p className="mt-1 text-ink-500">Scan to activate</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
