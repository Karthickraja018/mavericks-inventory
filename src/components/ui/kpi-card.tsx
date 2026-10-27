import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number | React.ReactNode;
  subtext?: string;
  href?: string;
  icon?: LucideIcon | React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "accent";
}

export function KpiCard({
  label,
  value,
  subtext,
  href,
  icon,
  variant = "default",
}: KpiCardProps) {
  let valColor = "var(--ink)";
  let iconBg = "var(--surface-subtle)";
  let iconColor = "var(--muted)";

  if (variant === "success") {
    valColor = "var(--success-dark)";
    iconBg = "var(--success-soft)";
    iconColor = "var(--success)";
  } else if (variant === "warning") {
    valColor = "var(--warning-dark)";
    iconBg = "var(--warning-soft)";
    iconColor = "var(--warning)";
  } else if (variant === "danger") {
    valColor = "var(--danger-dark)";
    iconBg = "var(--danger-soft)";
    iconColor = "var(--danger)";
  } else if (variant === "accent") {
    valColor = "var(--accent-dark)";
    iconBg = "var(--accent-soft)";
    iconColor = "var(--accent)";
  }

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return icon;
    }
    const IconComponent = icon as LucideIcon;
    return <IconComponent size={16} />;
  };

  const content = (
    <div
      className={`card ${href ? "metric-link" : ""}`}
      style={{
        margin: 0,
        padding: "16px 20px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        cursor: href ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", letterSpacing: "-0.01em" }}>
          {label}
        </span>
        {icon && (
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 28,
              height: 28,
              borderRadius: 6,
              background: iconBg,
              color: iconColor,
              flexShrink: 0,
            }}
          >
            {renderIcon()}
          </span>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: valColor, lineHeight: 1.15 }}>
          {value}
        </div>
        {subtext && (
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
            {subtext}
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        {content}
      </Link>
    );
  }

  return content;
}
