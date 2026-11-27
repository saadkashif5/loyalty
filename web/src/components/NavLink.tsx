"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A navigation link that knows when it is the current page, so the nav can
 * show where you are. `exact` for links whose path prefixes others (Overview).
 */
export function NavLink({
  href,
  exact = false,
  className,
  activeClassName,
  inactiveClassName = "",
  children,
}: {
  href: string;
  exact?: boolean;
  className: string;
  activeClassName: string;
  inactiveClassName?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${className} ${active ? activeClassName : inactiveClassName}`}
    >
      {children}
    </Link>
  );
}
