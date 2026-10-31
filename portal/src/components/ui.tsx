import type { ComponentProps, ReactNode } from "react";

// Sized for one-handed use on small, inexpensive Android phones.

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Button({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={`inline-flex w-full items-center justify-center rounded-xl bg-brand-500 px-4 py-3 text-base font-semibold text-white transition active:bg-brand-700 disabled:opacity-60 ${className}`}
    />
  );
}

export function TextButton({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={`w-full py-2 text-center text-sm text-slate-500 underline-offset-2 hover:underline ${className}`}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${className}`}
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
    info: "bg-slate-50 text-slate-700",
    success: "bg-emerald-50 text-emerald-800",
    warning: "bg-amber-50 text-amber-800",
  }[tone];
  return <div className={`rounded-xl px-4 py-3 text-sm ${styles}`}>{children}</div>;
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
              ? "border-brand-500 bg-brand-500 text-white"
              : "border-dashed border-slate-300 text-slate-300"
          }`}
        >
          {i < count ? "✓" : i + 1}
        </span>
      ))}
    </div>
  );
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  });
}
