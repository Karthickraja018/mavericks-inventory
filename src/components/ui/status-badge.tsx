import React from "react";

export type StatusType =
  | "DRAFT"
  | "PENDING_MANAGER"
  | "PENDING_AUTHORITY"
  | "PENDING"
  | "AWAITING_APPROVAL"
  | "VALIDATING"
  | "VALIDATED"
  | "APPROVED"
  | "POSTED"
  | "COMMITTED"
  | "REJECTED"
  | "FAILED"
  | "ROLLED_BACK"
  | "NEEDS_REVIEW"
  | "ACTIVE"
  | "INACTIVE"
  | "COMPLETED"
  | "HISTORICAL"
  | "NEW"
  | "WINNER"
  | "RUNNER_UP"
  | "PARTICIPANT"
  | "SPECIAL_RECOGNITION"
  | string;

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, label, size = "md" }: StatusBadgeProps) {
  const norm = String(status || "").toUpperCase();
  const displayLabel = label || norm.replace(/_/g, " ").toLowerCase();

  let variantClass = "status-neutral";

  if (["APPROVED", "POSTED", "COMMITTED", "ACTIVE"].includes(norm)) {
    variantClass = "status-success";
  } else if (
    ["PENDING_MANAGER", "PENDING_AUTHORITY", "PENDING", "AWAITING_APPROVAL", "VALIDATING"].includes(norm)
  ) {
    variantClass = "status-warning";
  } else if (["REJECTED", "FAILED", "ROLLED_BACK", "NEEDS_REVIEW", "INACTIVE"].includes(norm)) {
    variantClass = "status-danger";
  } else if (["WINNER", "RUNNER_UP"].includes(norm)) {
    variantClass = "status-accent";
  } else if (["PARTICIPANT", "SPECIAL_RECOGNITION", "COMPLETED"].includes(norm)) {
    variantClass = "status-info";
  }

  const isSmall = size === "sm";

  return (
    <span
      className={`status-badge ${variantClass}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isSmall ? "4px" : "6px",
        padding: isSmall ? "1px 7px" : "3px 10px",
        fontSize: isSmall ? "11px" : "12px",
        fontWeight: 600,
        borderRadius: "9999px",
        textTransform: "capitalize",
        whiteSpace: "nowrap",
        letterSpacing: "0.01em",
      }}
    >
      <span
        style={{
          width: isSmall ? "5px" : "6px",
          height: isSmall ? "5px" : "6px",
          borderRadius: "50%",
          backgroundColor: "currentColor",
          opacity: 0.85,
        }}
        aria-hidden="true"
      />
      <span>{displayLabel}</span>
    </span>
  );
}
