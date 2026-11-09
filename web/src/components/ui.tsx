import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </Card>
  );
}

export function Button({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60 ${className}`}
    />
  );
}

export function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
    >
      {children}
    </Link>
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
      className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 ${className}`}
    />
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <p className="text-sm text-red-600">{children}</p> : null;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <Card className="text-center text-sm text-slate-500">{children}</Card>;
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  INVITED: "bg-amber-50 text-amber-700",
  ASSIGNED: "bg-sky-50 text-sky-700",
  UNASSIGNED: "bg-slate-100 text-slate-600",
  SUSPENDED: "bg-red-50 text-red-700",
  REVOKED: "bg-red-50 text-red-700",
  REPLACED: "bg-slate-100 text-slate-600",
  REDEEMED: "bg-emerald-50 text-emerald-700",
  INACTIVE: "bg-slate-100 text-slate-600",
  DISABLED: "bg-slate-100 text-slate-600",
  DISMISSED: "bg-slate-100 text-slate-600",
  CONFIRMED: "bg-red-50 text-red-700",
  EXPIRED: "bg-slate-100 text-slate-600",
  TRIALING: "bg-sky-50 text-sky-700",
  PAST_DUE: "bg-amber-50 text-amber-700",
  CANCELLED: "bg-slate-100 text-slate-600",
  ISSUED: "bg-amber-50 text-amber-700",
  PAID: "bg-emerald-50 text-emerald-700",
  VOID: "bg-slate-100 text-slate-600",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}

const CONTROL =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select {...props} className={`${CONTROL} ${className}`} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${CONTROL} ${className}`} />;
}

const OUTLINE =
  "inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition disabled:opacity-60";

export function SecondaryButton({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={`${OUTLINE} border-slate-300 bg-white text-slate-700 hover:bg-slate-50 ${className}`}
    />
  );
}

export function DangerButton({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={`${OUTLINE} border-red-200 bg-white text-red-700 hover:bg-red-50 ${className}`}
    />
  );
}

export function SavedText({ show }: { show?: boolean }) {
  return show ? <p className="text-sm text-emerald-700">Saved.</p> : null;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function Pagination({
  basePath,
  params,
  page,
  limit,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  limit: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;

  const href = (p: number) => {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) query.set(k, v);
    query.set("page", String(p));
    return `${basePath}?${query.toString()}`;
  };

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-3">
        {page > 1 ? <Link href={href(page - 1)}>← Previous</Link> : null}
        {page < pages ? <Link href={href(page + 1)}>Next →</Link> : null}
      </div>
    </div>
  );
}

/** For lists paged by cursor: forward one page at a time, or back to the start. */
export function CursorPagination({
  basePath,
  params,
  nextCursor,
  isFirstPage,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  nextCursor?: string | null;
  isFirstPage: boolean;
}) {
  if (!nextCursor && isFirstPage) return null;

  const href = (cursor?: string) => {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) query.set(k, v);
    if (cursor) query.set("cursor", cursor);
    const qs = query.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
      {isFirstPage ? <span /> : <Link href={href()}>← Back to newest</Link>}
      {nextCursor ? <Link href={href(nextCursor)}>Older →</Link> : <span>End of list</span>}
    </div>
  );
}
