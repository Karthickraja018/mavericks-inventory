"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Bell,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  LogOut,
  User as UserIcon,
} from "lucide-react";

interface GlobalHeaderProps {
  user: {
    name: string;
    role: string;
  };
  pendingApprovalsCount?: number;
  needsReviewCount?: number;
  logout: (formData: FormData) => void;
}

const ROUTE_NAMES: Record<string, string> = {
  "/": "Overview",
  "/inventory": "Inventory",
  "/requests": "Distribution Requests",
  "/requests/new": "New Request",
  "/reports": "Reports & Exports",
  "/events": "Events & Goodies",
  "/employees": "Employees & Items",
  "/distribution": "Distribution Ledger",
  "/reconciliation": "Reconciliation",
  "/procurement": "Procurement",
  "/approvals": "Approvals",
  "/imports": "Import Center",
  "/audit": "Audit Log",
  "/users": "Users & Access",
};

export function GlobalHeader({
  user,
  pendingApprovalsCount = 0,
  needsReviewCount = 0,
  logout,
}: GlobalHeaderProps) {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Compute breadcrumbs
  const pathParts = pathname.split("/").filter(Boolean);
  const currentTitle = ROUTE_NAMES[pathname] || pathParts[pathParts.length - 1] || "Overview";

  const totalActionable = pendingApprovalsCount + needsReviewCount;

  return (
    <header
      style={{
        height: 52,
        borderBottom: "1px solid var(--line)",
        background: "var(--surface)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        position: "sticky",
        top: 0,
        zIndex: 15,
      }}
    >
      {/* Left: Breadcrumbs / Page Identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <span style={{ color: "var(--muted)", fontWeight: 500 }}>Mavericks</span>
        <ChevronRight size={14} style={{ color: "var(--line-strong)" }} />
        <span style={{ color: "var(--ink)", fontWeight: 650 }}>{currentTitle}</span>
      </div>

      {/* Right Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Quick Search trigger (visual hint) */}
        <Link
          href="/inventory"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 12px",
            background: "var(--surface-subtle)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            color: "var(--muted)",
            fontSize: 12.5,
            textDecoration: "none",
          }}
          title="Search inventory SKU or name"
        >
          <Search size={14} />
          <span>Search inventory…</span>
          <kbd
            style={{
              padding: "1px 5px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 4,
              fontSize: 10,
              color: "var(--muted)",
            }}
          >
            ⌘K
          </kbd>
        </Link>

        {/* Actionable Notifications Popover */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              setNotifOpen(!notifOpen);
              setProfileOpen(false);
              setHelpOpen(false);
            }}
            style={{ position: "relative" }}
            title="Workflow Notifications"
          >
            <Bell size={16} />
            {totalActionable > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--warning)",
                  border: "2px solid var(--surface)",
                }}
              />
            )}
          </button>

          {notifOpen && (
            <div
              className="card"
              style={{
                position: "absolute",
                right: 0,
                top: 40,
                width: 300,
                padding: 16,
                zIndex: 30,
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <strong style={{ fontSize: 13 }}>Workflow Alerts</strong>
                <span className="badge" style={{ fontSize: 10 }}>
                  {totalActionable} Actionable
                </span>
              </div>
              <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
                {pendingApprovalsCount > 0 ? (
                  <Link
                    href="/approvals"
                    onClick={() => setNotifOpen(false)}
                    style={{
                      padding: 8,
                      borderRadius: 6,
                      background: "var(--warning-soft)",
                      border: "1px solid var(--warning-border)",
                      color: "var(--warning-dark)",
                      display: "block",
                    }}
                  >
                    <strong>{pendingApprovalsCount} Request(s)</strong> awaiting your approval.
                  </Link>
                ) : (
                  <div style={{ color: "var(--muted)", padding: "4px 0" }}>
                    No pending approval requests for your role.
                  </div>
                )}

                {needsReviewCount > 0 && (
                  <Link
                    href="/requests?status=NEEDS_REVIEW"
                    onClick={() => setNotifOpen(false)}
                    style={{
                      padding: 8,
                      borderRadius: 6,
                      background: "var(--danger-soft)",
                      border: "1px solid var(--danger-border)",
                      color: "var(--danger-dark)",
                      display: "block",
                    }}
                  >
                    <strong>{needsReviewCount} Request(s)</strong> in Needs Review (insufficient stock).
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Documentation Help Popover */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              setHelpOpen(!helpOpen);
              setNotifOpen(false);
              setProfileOpen(false);
            }}
            title="Help & Documentation"
          >
            <HelpCircle size={16} />
          </button>

          {helpOpen && (
            <div
              className="card"
              style={{
                position: "absolute",
                right: 0,
                top: 40,
                width: 260,
                padding: 14,
                zIndex: 30,
                boxShadow: "var(--shadow-lg)",
                fontSize: 12.5,
              }}
            >
              <strong style={{ display: "block", marginBottom: 6 }}>Mavericks Operations Guide</strong>
              <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: 12 }}>
                Stock is ledger-maintained via movements. Distribution requests deduct stock upon final authority approval.
              </p>
              <div style={{ display: "grid", gap: 6 }}>
                <Link
                  href="/reports"
                  onClick={() => setHelpOpen(false)}
                  style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent)" }}
                >
                  <ExternalLink size={12} /> View Reports & Exports
                </Link>
                <Link
                  href="/imports"
                  onClick={() => setHelpOpen(false)}
                  style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent)" }}
                >
                  <ExternalLink size={12} /> Import Center Guidelines
                </Link>
              </div>
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 20, background: "var(--line)" }} />

        {/* User Identity Popover */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotifOpen(false);
              setHelpOpen(false);
            }}
            style={{
              background: "transparent",
              border: 0,
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div className="account-avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div style={{ textAlign: "left", display: "none" }} className="header-user-text">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block" }}>
                {user.name}
              </span>
              <span style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>
                {user.role.toLowerCase()}
              </span>
            </div>
          </button>

          {profileOpen && (
            <div
              className="card"
              style={{
                position: "absolute",
                right: 0,
                top: 40,
                width: 220,
                padding: 12,
                zIndex: 30,
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div style={{ padding: "4px 8px 10px", borderBottom: "1px solid var(--line)" }}>
                <div style={{ fontWeight: 650, fontSize: 13 }}>{user.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", textTransform: "capitalize" }}>
                  Role: {user.role.toLowerCase()}
                </div>
              </div>
              <div style={{ padding: "8px 0 4px", display: "grid", gap: 4 }}>
                <Link
                  href="/users"
                  onClick={() => setProfileOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    borderRadius: 6,
                    fontSize: 12.5,
                    color: "var(--ink-soft)",
                  }}
                >
                  <UserIcon size={14} /> Account Details
                </Link>
                {user.role === "ADMIN" && (
                  <Link
                    href="/audit"
                    onClick={() => setProfileOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: 6,
                      fontSize: 12.5,
                      color: "var(--ink-soft)",
                    }}
                  >
                    <ShieldCheck size={14} /> Security & Audit Log
                  </Link>
                )}
                <form action={logout} style={{ margin: "4px 0 0" }}>
                  <button
                    type="submit"
                    className="ghost"
                    style={{
                      width: "100%",
                      justifyContent: "flex-start",
                      fontSize: 12,
                      padding: "6px 8px",
                      minHeight: 30,
                      color: "var(--danger)",
                      borderColor: "transparent",
                    }}
                  >
                    <LogOut size={14} style={{ marginRight: 6 }} /> Sign Out
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
