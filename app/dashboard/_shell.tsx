"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICON = {
  home: (
    <Svg>
      <path d="M3 9.5 12 3l9 6.5" />
      <path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      <path d="M9 21v-6h6v6" />
    </Svg>
  ),
  users: (
    <Svg>
      <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4" />
      <path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8" />
    </Svg>
  ),
  bell: (
    <Svg>
      <path d="M18 8.5a6 6 0 0 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5" />
      <path d="M13.7 19a2 2 0 0 1-3.4 0" />
    </Svg>
  ),
  gear: (
    <Svg>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  ),
  chart: (
    <Svg>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M3 20h18" />
    </Svg>
  ),
  power: (
    <Svg>
      <path d="M12 3v9" />
      <path d="M6.6 6.8a8 8 0 1 0 10.8 0" />
    </Svg>
  ),
};

const TABS = [
  { href: "/dashboard", label: "Home", icon: ICON.home },
  { href: "/dashboard/members", label: "Members", icon: ICON.users },
  { href: "/dashboard/notify", label: "Notifications", icon: ICON.bell },
  { href: "/dashboard/stats", label: "Statistics", icon: ICON.chart },
  { href: "/dashboard/settings", label: "Settings", icon: ICON.gear },
];

export default function AppShell({ children, shopName }: { children: React.ReactNode; shopName: string }) {
  const path = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="side-brand" title={shopName}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={shopName} className="side-logo-img" />
          <span className="side-name">{shopName}<br /></span>
        </div>

        <nav className="side-nav">
          {TABS.map((t) => {
            const active = t.href === "/dashboard" ? path === t.href : path.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} className={`side-link ${active ? "active" : ""}`} title={t.label}>
                <span className="side-ico">{t.icon}</span>
                <span className="side-label">{t.label}</span>
              </Link>
            );
          })}
        </nav>

        <form action="/api/auth/logout" method="POST" className="side-logout">
          <button type="submit" title="Log out">
            <span className="side-ico">{ICON.power}</span><span className="side-label">Log out</span>
          </button>
        </form>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <span className="topbar-title">Staff area</span>
          <div className="topbar-right">
            <span className="topbar-badge">Loyalty · 9 stamps = free coffee</span>
            <span className="topbar-avatar" title="Manager">☕</span>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
