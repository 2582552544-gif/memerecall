"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/watchroom", label: "Watchroom" },
  { href: "/submit", label: "Submit KOL" },
];

export function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const activeHref = navItems.find((item) => {
    if (item.href === "/" && pathname === "/") return true;
    if (item.href === "/leaderboard" && (pathname === "/leaderboard" || pathname.startsWith("/analysis"))) return true;
    return pathname.startsWith(item.href) && item.href !== "/";
  })?.href || "/";

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Close on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      <header className="terminal-topbar">
        <div className="terminal-brand">
          <Link href="/">
            <img className="brand-logo" src="/assets/memerecall-logo.svg" alt="MemeRecall" />
          </Link>
          <Link href="/" className="brand-name">
            MemeRecall
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

        {/* Mobile hamburger button */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>

      {/* Mobile nav overlay */}
      <div
        className={`mobile-nav-overlay ${menuOpen ? "open" : ""}`}
        onClick={closeMenu}
        style={{ pointerEvents: menuOpen ? "auto" : "none" }}
      />

      {/* Mobile nav drawer */}
      <nav className={`mobile-nav-drawer ${menuOpen ? "open" : ""}`} aria-label="Mobile navigation">
        <button className="mobile-nav-close" onClick={closeMenu} aria-label="Close navigation menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <span className="brand-name">MemeRecall</span>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-nav-link ${activeHref === item.href ? "active" : ""}`}
            onClick={closeMenu}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
