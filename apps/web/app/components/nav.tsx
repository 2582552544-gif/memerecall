"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Leaderboard" },
  { href: "/watchroom", label: "Watchroom" },
  { href: "/submit", label: "Submit KOL" },
];

export function Nav() {
  const pathname = usePathname();

  // Analysis pages count as "Leaderboard" context
  const activeHref = navItems.find((item) => {
    if (item.href === "/" && (pathname === "/" || pathname.startsWith("/analysis"))) return true;
    return pathname.startsWith(item.href) && item.href !== "/";
  })?.href || "/";

  return (
    <header className="terminal-topbar">
      <div className="terminal-brand">
        <Link href="/">
          <img className="brand-logo" src="/assets/memerecall-logo.svg" alt="MemeRecall" />
        </Link>
        <Link href="/" className="brand-name">
          MemeRecall <small>v3.0</small>
        </Link>
      </div>
      <nav className="terminal-nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${activeHref === item.href ? "active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
