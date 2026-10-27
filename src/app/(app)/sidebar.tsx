"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = { href: string; label: string; icon?: string };

export function AppSidebar({
  user,
  logout,
}: {
  user: { name: string; role: string };
  logout: (formData: FormData) => void;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const primary: NavItem[] = [
    { href: "/", label: "Overview", icon: "📊" },
    { href: "/inventory", label: "Inventory", icon: "📦" },
    { href: "/requests", label: "Requests", icon: "📝" },
    { href: "/reports", label: "Reports", icon: "📈" },
  ];

  const operations: NavItem[] = [
    { href: "/events", label: "Events & Goodies", icon: "🎁" },
    { href: "/employees", label: "Employees & Items", icon: "👥" },
    { href: "/distribution", label: "Distribution Ledger", icon: "🚚" },
    { href: "/reconciliation", label: "Reconciliation", icon: "⚖️" },
    { href: "/procurement", label: "Procurement", icon: "📥" },
  ];

  const governance: NavItem[] = [];
  if (user.role === "MANAGER" || user.role === "AUTHORITY") {
    governance.push({ href: "/approvals", label: "Approvals", icon: "✅" });
  }
  if (user.role === "ADMIN") {
    governance.push(
      { href: "/imports", label: "Import Center", icon: "📂" },
      { href: "/audit", label: "Audit Log", icon: "🛡️" },
      { href: "/users", label: "Users & Access", icon: "🔑" },
    );
  }

  const renderItems = (items: NavItem[]) =>
    items.map((item) => {
      const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active ? "page" : undefined}
          onClick={() => setMobileOpen(false)}
        >
          {item.icon ? (
            <span style={{ fontSize: 13, marginRight: 2 }} aria-hidden="true">
              {item.icon}
            </span>
          ) : (
            <span className="nav-mark" aria-hidden="true" />
          )}
          <span>{item.label}</span>
        </Link>
      );
    });

  return (
    <>
      <button
        className="mobile-nav-toggle"
        type="button"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span aria-hidden="true">☰</span>
        <span>Menu</span>
      </button>
      <aside className={mobileOpen ? "is-open" : ""}>
        <Link className="brand" href="/" onClick={() => setMobileOpen(false)}>
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <span>
            <strong>Mavericks</strong>
            <small>Inventory & Goodies</small>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <span className="nav-section">Workspace</span>
          {renderItems(primary)}
          <span className="nav-section">Operations & Goodies</span>
          {renderItems(operations)}
          {governance.length > 0 && (
            <>
              <span className="nav-section">Governance</span>
              {renderItems(governance)}
            </>
          )}
        </nav>
        <form action={logout} className="account-card">
          <div className="account-avatar" aria-hidden="true">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="account-meta">
            <strong>{user.name}</strong>
            <small>{user.role.toLowerCase()}</small>
          </div>
          <button className="icon-button" aria-label="Sign out" title="Sign out">
            ↪
          </button>
        </form>
      </aside>
    </>
  );
}
