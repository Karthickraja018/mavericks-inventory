"use client";

import { useState, useMemo } from "react";
import { Plus, X, PackagePlus, AlertCircle, CheckCircle2, Search, ArrowRight } from "lucide-react";
import { createProcurementRecord } from "@/app/actions";

export interface ItemCatalogOption {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  size?: string;
  color?: string;
  brand?: string;
}

export function RecordProcurementDialog({ items }: { items: ItemCatalogOption[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [procMode, setProcMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || "");
  const [manualSku, setManualSku] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [qty, setQty] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter items for searchable select
  const filteredItems = useMemo(() => {
    if (!searchFilter.trim()) return items;
    const q = searchFilter.toLowerCase();
    return items.filter(
      (it) =>
        it.sku.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q)
    );
  }, [items, searchFilter]);

  const selectedItem = useMemo(() => {
    return items.find((it) => it.id === selectedItemId);
  }, [items, selectedItemId]);

  // Check if manual SKU matches an existing item
  const skuMatchInDb = useMemo(() => {
    if (!manualSku.trim()) return null;
    return items.find((it) => it.sku.toLowerCase() === manualSku.trim().toLowerCase());
  }, [items, manualSku]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn primary"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          minHeight: 34,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <PackagePlus size={15} /> Record Inbound Stock
      </button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(3px)",
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) setIsOpen(false);
          }}
        >
          <div
            className="card"
            style={{
              width: "min(100%, 580px)",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "var(--shadow-lg)",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <PackagePlus size={20} style={{ color: "var(--accent)" }} />
                  Record Inbound Procurement
                </h3>
                <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12.5 }}>
                  Receive vendor inventory shipments. Match existing variant SKUs to update live stock, or register new product lines.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
                className="icon-button"
                style={{ width: 28, height: 28 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Mode Selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 18, background: "var(--surface-subtle)", padding: 4, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => setProcMode("EXISTING")}
                style={{
                  flex: 1,
                  minHeight: 34,
                  fontSize: 12.5,
                  fontWeight: procMode === "EXISTING" ? 650 : 500,
                  background: procMode === "EXISTING" ? "var(--surface)" : "transparent",
                  color: procMode === "EXISTING" ? "var(--accent)" : "var(--muted)",
                  border: procMode === "EXISTING" ? "1px solid var(--line)" : "none",
                  boxShadow: procMode === "EXISTING" ? "var(--shadow-sm)" : "none",
                }}
              >
                Match Existing SKU
              </button>
              <button
                type="button"
                onClick={() => setProcMode("NEW")}
                style={{
                  flex: 1,
                  minHeight: 34,
                  fontSize: 12.5,
                  fontWeight: procMode === "NEW" ? 650 : 500,
                  background: procMode === "NEW" ? "var(--surface)" : "transparent",
                  color: procMode === "NEW" ? "var(--accent)" : "var(--muted)",
                  border: procMode === "NEW" ? "1px solid var(--line)" : "none",
                  boxShadow: procMode === "NEW" ? "var(--shadow-sm)" : "none",
                }}
              >
                + Add New Variant SKU
              </button>
            </div>

            <form
              action={async (formData) => {
                setIsSubmitting(true);
                try {
                  await createProcurementRecord(formData);
                } finally {
                  setIsSubmitting(false);
                }
              }}
              style={{ display: "grid", gap: 14 }}
            >
              {procMode === "EXISTING" ? (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                      Select Catalog Item to Receive *
                    </label>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input
                        type="text"
                        placeholder="Search SKU or item name…"
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        style={{ height: 34, fontSize: 12.5 }}
                      />
                    </div>
                    <select
                      value={selectedItemId}
                      onChange={(e) => setSelectedItemId(e.target.value)}
                      required
                      style={{ width: "100%", height: 38, fontSize: 13 }}
                    >
                      {filteredItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.sku} — {it.name} ({it.quantity} {it.unit} on hand)
                        </option>
                      ))}
                      {filteredItems.length === 0 && (
                        <option value="" disabled>
                          No matching items found
                        </option>
                      )}
                    </select>
                    {/* Hidden SKU input for form submission */}
                    <input type="hidden" name="sku" value={selectedItem?.sku || ""} />
                    <input type="hidden" name="name" value={selectedItem?.name || ""} />
                  </div>

                  {selectedItem && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 6,
                        background: "var(--surface-subtle)",
                        border: "1px solid var(--line)",
                        fontSize: 12.5,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ color: "var(--muted)" }}>Matched SKU:</span>
                        <code style={{ fontWeight: 700, color: "var(--accent)" }}>{selectedItem.sku}</code>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ color: "var(--muted)" }}>Category & Unit:</span>
                        <span>{selectedItem.category} · {selectedItem.unit}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--muted)" }}>Current On-Hand Balance:</span>
                        <strong>{selectedItem.quantity} {selectedItem.unit}</strong>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                    <div>
                      <label htmlFor="p-sku">SKU *</label>
                      <input
                        id="p-sku"
                        name="sku"
                        required
                        placeholder="e.g. SKU-501"
                        value={manualSku}
                        onChange={(e) => setManualSku(e.target.value.toUpperCase())}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label htmlFor="p-name">Item Display Name *</label>
                      <input
                        id="p-name"
                        name="name"
                        required={!skuMatchInDb}
                        placeholder={skuMatchInDb ? skuMatchInDb.name : "e.g. Wireless Ergonomic Mouse"}
                        defaultValue={skuMatchInDb?.name}
                      />
                    </div>
                  </div>

                  {skuMatchInDb && (
                    <div
                      style={{
                        padding: "8px 12px",
                        background: "rgba(16, 185, 129, 0.08)",
                        border: "1px solid rgba(16, 185, 129, 0.25)",
                        borderRadius: 6,
                        fontSize: 12,
                        color: "var(--success-dark)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                      <span>
                        SKU matches existing item <strong>&quot;{skuMatchInDb.name}&quot;</strong> (current stock: {skuMatchInDb.quantity} {skuMatchInDb.unit}). Stock will be updated!
                      </span>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <div>
                      <label htmlFor="p-size">Size / Spec</label>
                      <input id="p-size" name="size" placeholder="e.g. Standard" defaultValue={skuMatchInDb?.size} />
                    </div>
                    <div>
                      <label htmlFor="p-color">Color</label>
                      <input id="p-color" name="color" placeholder="e.g. Matte Black" defaultValue={skuMatchInDb?.color} />
                    </div>
                    <div>
                      <label htmlFor="p-brand">Brand</label>
                      <input id="p-brand" name="brand" placeholder="e.g. Logitech" defaultValue={skuMatchInDb?.brand} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label htmlFor="p-cat">Category</label>
                      <input id="p-cat" name="category" placeholder="e.g. Tech, Swag" defaultValue={skuMatchInDb?.category || "General"} />
                    </div>
                    <div>
                      <label htmlFor="p-unit">Unit of Measure</label>
                      <input id="p-unit" name="unit" defaultValue={skuMatchInDb?.unit || "pcs"} placeholder="pcs, box" />
                    </div>
                  </div>
                </>
              )}

              {/* Group 2: Inbound Details */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label htmlFor="p-qty">Quantity Received *</label>
                  <input
                    id="p-qty"
                    name="quantity"
                    type="number"
                    min="1"
                    required
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    style={{ fontWeight: 650 }}
                  />
                </div>
                <div>
                  <label htmlFor="p-date">Procurement Date</label>
                  <input
                    id="p-date"
                    name="procurementDate"
                    type="date"
                    defaultValue={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label htmlFor="p-mode">Inbound Mode</label>
                  <select id="p-mode" name="mode" defaultValue="NEW">
                    <option value="NEW">New Stock-In (Increments Inventory)</option>
                    <option value="HISTORICAL">Historical (Audit Provenance Only)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="p-ref">PO / Supplier Invoice Ref</label>
                  <input id="p-ref" name="sourceRef" placeholder="e.g. PO-8821 / Supplier XYZ" />
                </div>
              </div>

              <div>
                <label htmlFor="p-reason">Receipt Notes / Justification</label>
                <input id="p-reason" name="reason" placeholder="e.g. Quarterly replenishment batch" />
              </div>

              <div
                style={{
                  padding: "10px 12px",
                  background: "var(--surface-subtle)",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "var(--muted)",
                  display: "flex",
                  gap: 8,
                }}
              >
                <AlertCircle size={16} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
                <span>
                  Procurement stock-in atomically posts an immutable <code>PROCUREMENT_IN</code> transaction to the ledger and updates active variant quantities.
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Receiving Stock & Posting Ledger..." : "Receive Stock & Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

