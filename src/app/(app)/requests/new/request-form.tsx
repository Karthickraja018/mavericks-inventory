"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { createRequest } from "@/app/actions";

interface ItemOption {
  id: string;
  sku: string;
  name: string;
  size: string;
  color: string;
  brand: string;
  unit: string;
  quantity: number;
}

interface RequestLineState {
  itemId: string;
  quantity: number;
}

export function RequestForm({ items }: { items: ItemOption[] }) {
  const [purpose, setPurpose] = useState("");
  const [lines, setLines] = useState<RequestLineState[]>([
    { itemId: "", quantity: 1 },
  ]);

  const itemMap = new Map<string, ItemOption>();
  items.forEach((i) => itemMap.set(i.id, i));

  // Add line
  const handleAddLine = () => {
    if (lines.length >= 10) return;
    setLines([...lines, { itemId: "", quantity: 1 }]);
  };

  // Remove line
  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  // Change line
  const handleLineChange = (idx: number, field: keyof RequestLineState, val: string | number) => {
    const updated = [...lines];
    if (field === "itemId") {
      updated[idx].itemId = String(val);
    } else {
      updated[idx].quantity = Math.max(1, Number(val) || 1);
    }
    setLines(updated);
  };

  // Check for duplicates
  const selectedItemIds = lines.map((l) => l.itemId).filter(Boolean);
  const hasDuplicates = new Set(selectedItemIds).size !== selectedItemIds.length;

  // Check for insufficient stock warnings
  const stockWarnings = lines
    .filter((l) => {
      const it = itemMap.get(l.itemId);
      return it && it.quantity < l.quantity;
    })
    .map((l) => {
      const it = itemMap.get(l.itemId)!;
      return {
        name: it.name,
        available: it.quantity,
        requested: l.quantity,
        unit: it.unit,
      };
    });

  const totalRequestedUnits = lines.reduce((acc, l) => acc + (l.itemId ? l.quantity : 0), 0);
  const isValid = lines.some((l) => l.itemId && l.quantity > 0) && !hasDuplicates;

  return (
    <form action={createRequest} style={{ display: "grid", gap: 20 }}>
      {/* Purpose Card */}
      <div className="card" style={{ margin: 0, padding: 20 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>1. Request Justification</h3>
        <label htmlFor="purpose" style={{ fontWeight: 600 }}>
          Purpose / Business Justification *
        </label>
        <textarea
          id="purpose"
          name="purpose"
          required
          rows={3}
          placeholder="State why these items are requested (e.g., Regional sales enablement event, New hire hardware provisioning, Customer visit gift packs)..."
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          style={{ width: "100%", resize: "vertical" }}
        />
        <small style={{ color: "var(--muted)", display: "block", marginTop: 4 }}>
          This will be displayed to Manager and Authority approvers during review.
        </small>
      </div>

      {/* Dynamic Item Lines */}
      <div className="card" style={{ margin: 0, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: 15 }}>2. Requested Items</h3>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>
              Add one or more inventory items and specify required quantities.
            </p>
          </div>
          <button
            type="button"
            className="ghost"
            onClick={handleAddLine}
            disabled={lines.length >= 10}
            style={{ fontSize: 12.5, minHeight: 32, padding: "0 10px" }}
          >
            <Plus size={14} /> Add Another Item
          </button>
        </div>

        {hasDuplicates && (
          <div
            className="err"
            style={{
              padding: "10px 14px",
              fontSize: 12.5,
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <AlertCircle size={16} />
            <span>Duplicate items detected in request. Please combine quantities into a single row.</span>
          </div>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          {lines.map((line, idx) => {
            const selectedItem = itemMap.get(line.itemId);
            const isOutOfStock = selectedItem && selectedItem.quantity < line.quantity;

            return (
              <div
                key={idx}
                style={{
                  padding: "12px 14px",
                  background: "var(--surface-subtle)",
                  borderRadius: 6,
                  border: isOutOfStock ? "1px solid var(--warning-border)" : "1px solid var(--line)",
                  display: "grid",
                  gridTemplateColumns: "1fr 140px auto",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                {/* Hidden input binding to maintain createRequest server action contract */}
                <input type="hidden" name={`item${idx}`} value={line.itemId} />
                <input type="hidden" name={`qty${idx}`} value={line.itemId ? line.quantity : 0} />

                {/* Item Select */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <label style={{ fontSize: 11.5, margin: 0 }}>
                      Item {idx + 1} *
                    </label>
                    {selectedItem && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: selectedItem.quantity > 0 ? "var(--success)" : "var(--danger)",
                        }}
                      >
                        Available Stock: {selectedItem.quantity} {selectedItem.unit}
                      </span>
                    )}
                  </div>
                  <select
                    value={line.itemId}
                    onChange={(e) => handleLineChange(idx, "itemId", e.target.value)}
                    required
                    style={{ fontSize: 13, minHeight: 36 }}
                  >
                    <option value="">-- Choose inventory item variant --</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.sku} · {it.name}
                        {it.size ? ` (${it.size})` : ""}
                        {it.color ? ` - ${it.color}` : ""}
                        {` [Stock: ${it.quantity} ${it.unit}]`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label style={{ fontSize: 11.5, marginBottom: 4 }}>
                    Quantity {selectedItem ? `(${selectedItem.unit})` : ""}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={line.quantity}
                    onChange={(e) => handleLineChange(idx, "quantity", e.target.value)}
                    required
                    style={{ fontSize: 13, minHeight: 36 }}
                  />
                </div>

                {/* Remove Line Button */}
                <div style={{ paddingTop: 18 }}>
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    disabled={lines.length <= 1}
                    className="icon-button"
                    style={{
                      width: 34,
                      height: 34,
                      opacity: lines.length <= 1 ? 0.4 : 1,
                      color: "var(--danger)",
                    }}
                    title="Remove item row"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Stock warning callouts */}
        {stockWarnings.length > 0 && (
          <div
            className="err"
            style={{
              marginTop: 14,
              marginBottom: 0,
              background: "#fffbeb",
              borderColor: "#fde68a",
              color: "#92400e",
              fontSize: 12.5,
            }}
          >
            <strong>Stock Notice:</strong>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
              {stockWarnings.map((w, i) => (
                <li key={i}>
                  <strong>{w.name}</strong>: Requested {w.requested} {w.unit}, but only {w.available} {w.unit} available.
                  If submitted, this request may trigger <em>NEEDS_REVIEW</em> status during approval until replenished.
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Summary & Submission */}
      <div className="card" style={{ margin: 0, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Request Summary:</span>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>
              {lines.filter((l) => l.itemId).length} distinct items · {totalRequestedUnits} total units
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/requests">
              <button type="button" className="ghost" style={{ minHeight: 36 }}>
                Cancel
              </button>
            </Link>
            <button
              type="submit"
              name="intent"
              value="draft"
              className="ghost"
              disabled={!isValid || !purpose.trim()}
              style={{ minHeight: 36 }}
            >
              Save as Draft
            </button>
            <button
              type="submit"
              name="intent"
              value="submit"
              disabled={!isValid || !purpose.trim()}
              style={{ minHeight: 36 }}
            >
              Submit for Approval →
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
