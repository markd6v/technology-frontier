"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/domains", label: "Domains" },
  { href: "/sources", label: "Sources" },
  { href: "/people", label: "People" },
  { href: "/framework", label: "Framework" },
];

export function Nav() {
  const pathname = usePathname();
  const active = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`) || (href === "/domains" && pathname.startsWith("/d/"));
  return (
    <nav className="-mx-2 flex min-w-0 gap-1 overflow-x-auto text-sm [scrollbar-width:none]">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={active(l.href) ? "page" : undefined}
          className={`shrink-0 rounded-md px-2 py-1 ${
            active(l.href) ? "bg-surface-2 font-medium text-ink" : "text-muted hover:text-ink"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
