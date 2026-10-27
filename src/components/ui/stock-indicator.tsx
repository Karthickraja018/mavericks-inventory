import React from "react";

interface StockIndicatorProps {
  quantity: number | string;
  unit?: string;
  lowStockThreshold?: number;
}

export function StockIndicator({
  quantity,
  unit = "pcs",
  lowStockThreshold = 10,
}: StockIndicatorProps) {
  const qty = Number(quantity);
  const isOutOfStock = qty <= 0;
  const isLowStock = qty > 0 && qty <= lowStockThreshold;

  let bg = "var(--success-soft)";
  let color = "var(--success-dark)";
  let border = "var(--success-border)";
  let label = "In Stock";

  if (isOutOfStock) {
    bg = "var(--danger-soft)";
    color = "var(--danger-dark)";
    border = "var(--danger-border)";
    label = "Out of Stock";
  } else if (isLowStock) {
    bg = "var(--warning-soft)";
    color = "var(--warning-dark)";
    border = "var(--warning-border)";
    label = "Low Stock";
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        {qty.toLocaleString()} <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}>{unit}</span>
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "1px 6px",
          borderRadius: 4,
          fontSize: 10.5,
          fontWeight: 700,
          background: bg,
          color,
          border: `1px solid ${border}`,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor" }} />
        {label}
      </span>
    </div>
  );
}
