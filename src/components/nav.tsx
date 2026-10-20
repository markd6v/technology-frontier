"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "This week" },
  { href: "/domains", label: "Domains" },
  { href: "/feed", label: "All items" },
];

export function Nav() {
  const pathname = usePathname();
  const active = (href: string) =>
    pathname === href ||
    (href !== "/" && pathname.startsWith(`${href}/`)) ||
    (href === "/domains" && pathname.startsWith("/d/"));
  return (
    <nav className="flex min-w-0 gap-3 overflow-x-auto sm:gap-4 text-sm [scrollbar-width:none]">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={active(l.href) ? "page" : undefined}
          className={`shrink-0 ${active(l.href) ? "text-ink underline decoration-1 underline-offset-[6px]" : "text-muted hover:text-ink"}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
