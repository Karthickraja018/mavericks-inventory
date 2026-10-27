import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  badge,
  breadcrumbs,
  actions,
}: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 24 }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12, color: "var(--muted)" }}
        >
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {crumb.href && !isLast ? (
                  <Link href={crumb.href} style={{ color: "var(--muted)", textDecoration: "none" }}>
                    <span style={{ transition: "color .15s" }}>{crumb.label}</span>
                  </Link>
                ) : (
                  <span style={{ color: isLast ? "var(--ink-soft)" : "var(--muted)", fontWeight: isLast ? 600 : 400 }}>
                    {crumb.label}
                  </span>
                )}
                {!isLast && <ChevronRight size={13} style={{ color: "var(--line-strong)", flexShrink: 0 }} />}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ maxWidth: 800 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.025em" }}>{title}</h1>
            {badge}
          </div>
          {description && (
            <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13.5, lineHeight: 1.5 }}>
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
