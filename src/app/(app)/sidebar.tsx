"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  FileSpreadsheet,
  Gift,
  Users,
  ScrollText,
  Scale,
  ShoppingBag,
  CheckCircle2,
  UploadCloud,
  ShieldCheck,
  KeyRound,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeCount?: number;
  badgeVariant?: "warning" | "danger" | "default";
};

export function AppSidebar({
  user,
  pendingApprovalsCount = 0,
  needsReviewCount = 0,
  logout,
}: {
  user: { name: string; role: string };
  pendingApprovalsCount?: number;
  needsReviewCount?: number;
  logout: (formData: FormData) => void;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Groups per specification
  const workspaceItems: NavItem[] = [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/inventory", label: "Inventory", icon: Boxes },
    {
      href: "/requests",
      label: "Distribution Requests",
      icon: ClipboardList,
      badgeCount: needsReviewCount > 0 ? needsReviewCount : undefined,
      badgeVariant: "danger",
    },
    { href: "/reports", label: "Reports & Exports", icon: FileSpreadsheet },
  ];

  const operationsItems: NavItem[] = [
    { href: "/events", label: "Events & Goodies", icon: Gift },
    { href: "/employees", label: "Employees & Items", icon: Users },
    { href: "/distribution", label: "Distribution Ledger", icon: ScrollText },
    { href: "/reconciliation", label: "Reconciliation", icon: Scale },
    { href: "/procurement", label: "Procurement", icon: ShoppingBag },
  ];

  const governanceItems: NavItem[] = [];
  if (user.role === "MANAGER" || user.role === "AUTHORITY" || user.role === "ADMIN") {
    governanceItems.push({
      href: "/approvals",
      label: "Approvals",
      icon: CheckCircle2,
      badgeCount: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
      badgeVariant: "warning",
    });
  }
  if (user.role === "ADMIN") {
    governanceItems.push(
      { href: "/imports", label: "Import Center", icon: UploadCloud },
      { href: "/audit", label: "Audit Log", icon: ShieldCheck },
      { href: "/users", label: "Users & Access", icon: KeyRound }
    );
  }

  const renderSection = (title: string, items: NavItem[]) => (
    <div style={{ marginBottom: 16 }}>
      {!collapsed && (
        <span
          style={{
            display: "block",
            padding: "8px 12px 6px",
            color: "var(--faint)",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
      )}
      <div style={{ display: "grid", gap: 2 }}>
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minHeight: 36,
                padding: collapsed ? "0 10px" : "0 12px",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: active ? 650 : 500,
                color: active ? "var(--accent-dark)" : "var(--ink-soft)",
                background: active ? "var(--accent-soft)" : "transparent",
                transition: "all .12s ease",
              }}
            >
              <Icon
                size={16}
                style={{
                  color: active ? "var(--accent)" : "var(--muted)",
                  flexShrink: 0,
                }}
              />
              {!collapsed && (
                <>
                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.label}
                  </span>
                  {item.badgeCount !== undefined && item.badgeCount > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 999,
                        background:
                          item.badgeVariant === "danger"
                            ? "var(--danger-soft)"
                            : item.badgeVariant === "warning"
                            ? "var(--warning-soft)"
                            : "var(--surface-subtle)",
                        color:
                          item.badgeVariant === "danger"
                            ? "var(--danger)"
                            : item.badgeVariant === "warning"
                            ? "var(--warning-dark)"
                            : "var(--ink)",
                        border: `1px solid ${
                          item.badgeVariant === "danger"
                            ? "var(--danger-border)"
                            : item.badgeVariant === "warning"
                            ? "var(--warning-border)"
                            : "var(--line)"
                        }`,
                      }}
                    >
                      {item.badgeCount}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <button
        className="mobile-nav-toggle"
        type="button"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((open) => !open)}
      >
        <Menu size={18} />
        <span>Menu</span>
      </button>

      <aside
        className={`${mobileOpen ? "is-open" : ""} ${collapsed ? "is-collapsed" : ""}`}
        style={{
          width: collapsed ? 68 : 248,
          transition: "width .2s cubic-bezier(0.16, 1, 0.3, 1), transform .25s ease",
          padding: collapsed ? "16px 8px" : "18px 12px",
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            padding: "0 6px 14px",
            borderBottom: "1px solid var(--line)",
            marginBottom: 14,
          }}
        >
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
                flexShrink: 0,
              }}
            >
              M
            </div>
            {!collapsed && (
              <div>
                <strong style={{ fontSize: 14, letterSpacing: "-0.02em", color: "var(--ink)", display: "block" }}>
                  Mavericks
                </strong>
                <small style={{ color: "var(--muted)", fontSize: 10.5, display: "block", marginTop: -2 }}>
                  Inventory & Goodies
                </small>
              </div>
            )}
          </Link>

          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              style={{
                width: 24,
                height: 24,
                padding: 0,
                minHeight: 24,
                background: "transparent",
                border: "1px solid var(--line)",
                borderRadius: 4,
                color: "var(--muted)",
                cursor: "pointer",
              }}
              title="Collapse sidebar"
            >
              <ChevronLeft size={14} />
            </button>
          )}
        </div>

        {/* Collapsed expand button */}
        {collapsed && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              style={{
                width: 28,
                height: 28,
                padding: 0,
                minHeight: 28,
                background: "transparent",
                border: "1px solid var(--line)",
                borderRadius: 6,
                color: "var(--muted)",
                cursor: "pointer",
              }}
              title="Expand sidebar"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Nav Sections */}
        <nav aria-label="Main navigation" style={{ flex: 1, overflowY: "auto" }}>
          {renderSection("Workspace", workspaceItems)}
          {renderSection("Operations & Goodies", operationsItems)}
          {governanceItems.length > 0 && renderSection("Governance", governanceItems)}
        </nav>

        {/* User Card */}
        <div
          style={{
            paddingTop: 12,
            borderTop: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: collapsed ? "center" : "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div
              className="account-avatar"
              style={{
                width: 30,
                height: 30,
                fontSize: 11.5,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            {!collapsed && (
              <div style={{ minWidth: 0, overflow: "hidden" }}>
                <strong
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink)",
                    display: "block",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user.name}
                </strong>
                <small style={{ color: "var(--muted)", fontSize: 10.5, display: "block", textTransform: "capitalize" }}>
                  {user.role.toLowerCase()}
                </small>
              </div>
            )}
          </div>
          {!collapsed && (
            <form action={logout} style={{ margin: 0 }}>
              <button
                type="submit"
                className="icon-button"
                style={{ width: 28, height: 28, minHeight: 28, minWidth: 28 }}
                title="Sign out"
              >
                <LogOut size={13} />
              </button>
            </form>
          )}
        </div>
      </aside>
    </>
  );
}
