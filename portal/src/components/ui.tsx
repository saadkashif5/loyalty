import type { ComponentProps, ReactNode } from "react";
import { UI } from "@taptapsell/brand/styles";
import { Flower } from "@/components/landing/icons";

// Sized for one-handed use on small, inexpensive Android phones.

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${UI.card} ${className}`}>{children}</div>;
}

export function Button({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-3.5 font-display text-base font-bold text-white shadow-[0_10px_24px_-12px_rgb(var(--brand-600)/0.9)] transition hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 ${className}`}
    />
  );
}

export function TextButton({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={`w-full py-2 text-center text-sm text-ink-500 underline-offset-2 hover:underline ${className}`}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={UI.label}>{label}</span>
      {children}
    </label>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-ink/15 bg-white px-4 py-3.5 text-base text-ink outline-none transition placeholder:text-ink-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 ${className}`}
    />
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? (
    <p role="alert" className="text-sm text-red-600">
      {children}
    </p>
  ) : null;
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "warning";
  children: ReactNode;
}) {
  const styles = {
    info: "bg-white text-ink-700 ring-1 ring-ink/10",
    success: "bg-mint-50 text-mint-800 ring-1 ring-mint-500/25",
    warning: "bg-accent-50 text-accent-800 ring-1 ring-accent-300/50",
  }[tone];
  return <div className={`rounded-2xl px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

/** The card itself: one circle per stamp, filled as they are collected. */
export function StampDots({ count, required }: { count: number; required: number }) {
  return (
    <div className="flex flex-wrap gap-2" aria-label={`${count} of ${required} stamps`}>
      {Array.from({ length: required }, (_, i) => (
        <span
          key={i}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold ${
            i < count
              ? "border-brand-500 bg-brand-500 text-white shadow-[0_6px_14px_-8px_rgb(var(--brand-600)/0.9)]"
              : "border-dashed border-ink-200 text-ink-300"
          }`}
        >
          {i < count ? <Flower className="h-4 w-4" /> : i + 1}
        </span>
      ))}
    </div>
  );
}

/**
 * A loyalty card as the customer sees it: Midnight Ink, like the stamper,
 * with a Stamp Orange stamp for every visit and the flower as a watermark.
 */
export function StampCardFace({
  shop,
  program,
  count,
  required,
  footer,
}: {
  shop: string;
  program?: string;
  count: number;
  required: number;
  footer?: ReactNode;
}) {
  const full = required > 0 && count >= required;
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] bg-ink p-5 text-crema shadow-[0_24px_50px_-28px_rgb(var(--ink-900)/0.9)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-brand-500/30 blur-3xl"
      />
      <Flower className="pointer-events-none absolute -bottom-10 -end-10 h-40 w-40 text-white/[0.05]" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500 font-display text-lg font-bold text-ink">
            {shop.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold leading-tight">{shop}</p>
            {program ? <p className="truncate text-sm text-ink-300">{program}</p> : null}
          </div>
        </div>
        {required > 0 ? (
          <p
            className={`shrink-0 rounded-full px-2.5 py-1 font-display text-sm font-bold tabular-nums ${
              full ? "bg-mint text-ink" : "bg-white/10 text-crema"
            }`}
          >
            {count}/{required}
          </p>
        ) : null}
      </div>
      {required > 0 ? (
        <div
          className="relative mt-5 grid grid-cols-5 gap-2.5"
          role="img"
          aria-label={`${count} of ${required} stamps`}
        >
          {Array.from({ length: required }, (_, i) => {
            const filled = i < count;
            const last = i === required - 1;
            return (
              <span
                key={i}
                className={`flex aspect-square items-center justify-center rounded-full ${
                  filled
                    ? full
                      ? "bg-mint text-ink"
                      : "bg-brand-500 text-white shadow-[0_6px_16px_-6px_rgb(var(--brand-500)/0.9)]"
                    : last
                      ? "border-2 border-dashed border-accent-300/70 text-accent-300"
                      : "border-2 border-dashed border-white/15"
                }`}
              >
                {filled ? (
                  <Flower className="h-1/2 w-1/2" />
                ) : last ? (
                  <span aria-hidden className="text-sm">
                    ★
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
      ) : null}
      {footer ? <div className="relative mt-4">{footer}</div> : null}
    </div>
  );
}

/** A page's title in the customer app. */
export function ScreenTitle({ children }: { children: ReactNode }) {
  return <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{children}</h1>;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  });
}
