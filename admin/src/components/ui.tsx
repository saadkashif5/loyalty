import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { UI, statusClass, statusLabel } from "@taptapsell/brand/styles";

// The admin console's building blocks. The look comes from packages/brand/src/styles.ts,
// shared with the business dashboard and the customer portal.

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${UI.card} ${className}`}>{children}</div>;
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
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className={UI.pageTitle}>{title}</h1>
        {description ? <p className={UI.pageDescription}>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, href }: { label: string; value: ReactNode; href?: string }) {
  const body = (
    <Card
      className={href ? "h-full transition hover:-translate-y-0.5 hover:border-brand-500/40" : ""}
    >
      <p className={UI.statLabel}>
        <span aria-hidden className={UI.statDot} />
        {label}
      </p>
      <p className={UI.statValue}>{value}</p>
    </Card>
  );
  return href ? (
    <Link
      href={href}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

export function Button({ className = "", ...props }: ComponentProps<"button">) {
  return <button {...props} className={`${UI.buttonBase} ${UI.buttonPrimary} ${className}`} />;
}

export function SecondaryButton({ className = "", ...props }: ComponentProps<"button">) {
  return <button {...props} className={`${UI.buttonBase} ${UI.buttonSecondary} ${className}`} />;
}

export function DangerButton({ className = "", ...props }: ComponentProps<"button">) {
  return <button {...props} className={`${UI.buttonBase} ${UI.buttonDanger} ${className}`} />;
}

export function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={`${UI.buttonBase} ${UI.buttonPrimary}`}>
      {children}
    </Link>
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
  return <input {...props} className={`${UI.control} ${className}`} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select {...props} className={`${UI.control} ${className}`} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${UI.control} ${className}`} />;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <p className={UI.errorText}>{children}</p> : null;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <Card className={UI.emptyState}>{children}</Card>;
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className={UI.tableWrap}>
      <table className={UI.table}>
        <thead className={UI.tableHead}>
          <tr>
            {head.map((h) => (
              <th key={h} className={UI.tableHeadCell}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={UI.tableBody}>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`${UI.tableCell} ${className}`}>{children}</td>;
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={statusClass(status)}>{statusLabel(status)}</span>;
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
    <div className={UI.pager}>
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={UI.pagerLink}>
            ← Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={href(page + 1)} className={UI.pagerLink}>
            Next →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** Pakistani rupees, no decimals: "PKR 2,999". */
export function formatPkr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `PKR ${amount.toLocaleString("en-PK")}`;
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
    <div className={UI.pager}>
      {isFirstPage ? (
        <span />
      ) : (
        <Link href={href()} className={UI.pagerLink}>
          ← Back to newest
        </Link>
      )}
      {nextCursor ? (
        <Link href={href(nextCursor)} className={UI.pagerLink}>
          Older →
        </Link>
      ) : (
        <span>End of list</span>
      )}
    </div>
  );
}
