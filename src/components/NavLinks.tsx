"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const LINKS = [
  { href: "/games", label: "Games" },
  { href: "/guides", label: "Guides" },
  { href: "/forums", label: "Forums" },
  { href: "/leaderboards", label: "Leaderboards", short: "Boards" },
  { href: "/sessions", label: "Sessions" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="hidden h-full items-stretch lg:flex" aria-label="Main">
      {LINKS.map((l) => {
        const active = path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center border-b-2 px-3 text-sm",
              active ? "border-accent text-text" : "border-transparent text-muted hover:text-text",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-bg lg:hidden" aria-label="Mobile">
      {[{ href: "/", label: "Home", short: undefined }, ...LINKS].map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex-1 border-t-2 py-3 text-center text-[11px] font-semibold",
              active ? "border-accent text-text" : "border-transparent text-muted",
            )}
          >
            {l.short ?? l.label}
          </Link>
        );
      })}
    </nav>
  );
}
