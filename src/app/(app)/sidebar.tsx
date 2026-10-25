"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = { href: string; label: string };

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
    { href: "/", label: "Overview" },
    { href: "/inventory", label: "Inventory" },
    { href: "/requests", label: "Requests" },
    { href: "/reports", label: "Reports" },
  ];
  const operations: NavItem[] = [
    { href: "/reconciliation", label: "Reconciliation" },
    { href: "/procurement", label: "Procurement" },
    { href: "/distribution", label: "Distribution" },
  ];
  const governance: NavItem[] = [];
  if (user.role === "MANAGER" || user.role === "AUTHORITY") governance.push({ href: "/approvals", label: "Approvals" });
  if (user.role === "ADMIN") {
    governance.push(
      { href: "/imports", label: "Import center" },
      { href: "/audit", label: "Audit log" },
      { href: "/employees", label: "Employees" },
      { href: "/users", label: "Users" },
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
          <span className="nav-mark" aria-hidden="true" />
          {item.label}
        </Link>
      );
    });

  return (
    <>
      <button className="mobile-nav-toggle" type="button" aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>
        <span aria-hidden="true">☰</span>
        <span>Menu</span>
      </button>
      <aside className={mobileOpen ? "is-open" : ""}>
        <Link className="brand" href="/" onClick={() => setMobileOpen(false)}>
          <span className="brand-mark" aria-hidden="true">M</span>
          <span><strong>Mavericks</strong><small>Inventory operations</small></span>
        </Link>
        <nav aria-label="Main navigation">
          <span className="nav-section">Workspace</span>
          {renderItems(primary)}
          <span className="nav-section">Operations</span>
          {renderItems(operations)}
          {governance.length > 0 && <><span className="nav-section">Governance</span>{renderItems(governance)}</>}
        </nav>
        <form action={logout} className="account-card">
          <div className="account-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</div>
          <div className="account-meta"><strong>{user.name}</strong><small>{user.role.toLowerCase()}</small></div>
          <button className="icon-button" aria-label="Sign out" title="Sign out">↪</button>
        </form>
      </aside>
    </>
  );
}
