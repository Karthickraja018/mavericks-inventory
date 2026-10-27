import React from "react";
import { LucideIcon, PackageOpen } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon | React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon = PackageOpen,
  title,
  description,
  action,
}: EmptyStateProps) {
  const renderIcon = () => {
    if (React.isValidElement(icon)) {
      return icon;
    }
    const IconComponent = icon as LucideIcon;
    return <IconComponent size={24} />;
  };

  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "var(--surface-subtle)",
          border: "1px solid var(--border-subtle)",
          display: "grid",
          placeItems: "center",
          color: "var(--foreground-muted)",
          marginBottom: 16,
        }}
      >
        {renderIcon()}
      </div>

      <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 650, color: "var(--ink)" }}>{title}</h3>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)", maxWidth: 400 }}>{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
