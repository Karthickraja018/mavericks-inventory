"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, Search, Filter, Download, X, AlertCircle } from "lucide-react";
import { StockIndicator } from "@/components/ui/stock-indicator";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { createItem } from "@/app/actions";

export interface InventoryItemData {
  id: string;
  sku: string;
  name: string;
  size: string;
  color: string;
  brand: string;
  category: string;
  unit: string;
  quantity: number;
  active: boolean;
}

interface InventoryViewProps {
  items: InventoryItemData[];
  userRole: string;
  categories: string[];
  initialQuery?: string;
  initialStockFilter?: string;
}

export function InventoryView({
  items,
  userRole,
  categories,
  initialQuery = "",
  initialStockFilter = "ALL",
}: InventoryViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [stockFilter, setStockFilter] = useState(initialStockFilter);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter items
  const filteredItems = items.filter((item) => {
    // Search matching
    if (query.trim()) {
      const q = query.toLowerCase();
      const match =
        item.sku.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.size.toLowerCase().includes(q) ||
        item.color.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      if (!match) return false;
    }

    // Category filter
    if (categoryFilter !== "ALL" && item.category !== categoryFilter) {
      return false;
    }

    // Stock level filter
    if (stockFilter === "IN_STOCK") {
      return item.active && item.quantity > 10;
    } else if (stockFilter === "LOW_STOCK") {
      return item.active && item.quantity > 0 && item.quantity <= 10;
    } else if (stockFilter === "OUT_OF_STOCK") {
      return item.active && item.quantity <= 0;
    } else if (stockFilter === "INACTIVE") {
      return !item.active;
    }

    return true;
  });

  return (
    <>
      {/* Filter and Action Toolbar */}
      <div
        className="card"
        style={{
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 260 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
            <Search
              size={15}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}
            />
            <input
              type="text"
              placeholder="Filter by SKU, name, brand, size, or color…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: 32, minHeight: 34, fontSize: 13 }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: 0,
                  padding: 2,
                  minHeight: "auto",
                  color: "var(--muted)",
                  boxShadow: "none",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              style={{ minHeight: 34, fontSize: 12.5, width: 140 }}
            >
              <option value="ALL">All Stock Levels</option>
              <option value="IN_STOCK">In Stock (&gt;10)</option>
              <option value="LOW_STOCK">Low Stock (1-10)</option>
              <option value="OUT_OF_STOCK">Out of Stock (0)</option>
              <option value="INACTIVE">Inactive Variants</option>
            </select>

            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ minHeight: 34, fontSize: 12.5, width: 140 }}
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {(query || stockFilter !== "ALL" || categoryFilter !== "ALL") && (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setQuery("");
                  setStockFilter("ALL");
                  setCategoryFilter("ALL");
                }}
                style={{ minHeight: 34, fontSize: 12, padding: "0 10px" }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Showing <strong>{filteredItems.length}</strong> of {items.length} items
          </span>

          <a href="/reports/stock.csv" download>
            <button type="button" className="ghost" style={{ minHeight: 34, fontSize: 12.5, padding: "0 12px" }}>
              <Download size={14} /> Export CSV
            </button>
          </a>

          {userRole === "ADMIN" && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              style={{ minHeight: 34, fontSize: 12.5, padding: "0 14px" }}
            >
              <Plus size={14} /> Add Item
            </button>
          )}
        </div>
      </div>

      {/* Item Table */}
      <div className="card scroll" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 120 }}>SKU</th>
              <th>Item Name</th>
              <th>Attributes</th>
              <th>Category</th>
              <th className="numeric" style={{ width: 160 }}>Available Stock</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ textAlign: "right", width: 100 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id} style={item.active ? undefined : { opacity: 0.6 }}>
                <td>
                  <Link href={`/inventory/${item.id}`}>
                    <code style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{item.sku}</code>
                  </Link>
                </td>
                <td>
                  <Link
                    href={`/inventory/${item.id}`}
                    style={{ fontWeight: 600, color: "var(--ink)", textDecoration: "none" }}
                  >
                    {item.name}
                  </Link>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", fontSize: 11.5 }}>
                    {item.size && (
                      <span
                        style={{
                          background: "var(--surface-subtle)",
                          padding: "1px 5px",
                          borderRadius: 4,
                          border: "1px solid var(--line)",
                        }}
                      >
                        Size: {item.size}
                      </span>
                    )}
                    {item.color && (
                      <span
                        style={{
                          background: "var(--surface-subtle)",
                          padding: "1px 5px",
                          borderRadius: 4,
                          border: "1px solid var(--line)",
                        }}
                      >
                        {item.color}
                      </span>
                    )}
                    {item.brand && (
                      <span
                        style={{
                          background: "var(--surface-subtle)",
                          padding: "1px 5px",
                          borderRadius: 4,
                          border: "1px solid var(--line)",
                        }}
                      >
                        {item.brand}
                      </span>
                    )}
                    {!item.size && !item.color && !item.brand && (
                      <span style={{ color: "var(--faint)" }}>Standard</span>
                    )}
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{item.category || "General"}</span>
                </td>
                <td className="numeric">
                  <StockIndicator quantity={item.quantity} unit={item.unit} />
                </td>
                <td>
                  <StatusBadge status={item.active ? "ACTIVE" : "INACTIVE"} size="sm" />
                </td>
                <td style={{ textAlign: "right" }}>
                  <Link href={`/inventory/${item.id}`}>
                    <button className="ghost" style={{ fontSize: 11.5, padding: "2px 8px", minHeight: 28 }}>
                      Inspect →
                    </button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredItems.length === 0 && (
          <EmptyState
            title="No items found"
            description="No inventory items matched your active search and filter criteria."
            action={
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setQuery("");
                  setStockFilter("ALL");
                  setCategoryFilter("ALL");
                }}
              >
                Clear all filters
              </button>
            }
          />
        )}
      </div>

      {/* Add Item Modal Dialog */}
      {isAddModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              width: "min(100%, 540px)",
              padding: 24,
              boxShadow: "var(--shadow-lg)",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Add Product Variant</h3>
                <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12.5 }}>
                  Define identity and variant attributes. Stock balance is maintained via ledger transactions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="icon-button"
                style={{ width: 28, height: 28 }}
              >
                <X size={16} />
              </button>
            </div>

            <form
              action={async (formData) => {
                setIsSubmitting(true);
                try {
                  await createItem(formData);
                } finally {
                  setIsSubmitting(false);
                }
              }}
              style={{ display: "grid", gap: 14 }}
            >
              {/* Group 1: Identity */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                <div>
                  <label htmlFor="sku">SKU *</label>
                  <input id="sku" name="sku" required placeholder="e.g. SKU-101" autoFocus />
                </div>
                <div>
                  <label htmlFor="name">Display Name *</label>
                  <input id="name" name="name" required placeholder="e.g. Mavericks Polo Shirt" />
                </div>
              </div>

              {/* Group 2: Attributes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label htmlFor="size">Size / Spec</label>
                  <input id="size" name="size" placeholder="e.g. M, L, XL" />
                </div>
                <div>
                  <label htmlFor="color">Color</label>
                  <input id="color" name="color" placeholder="e.g. Navy, Black" />
                </div>
                <div>
                  <label htmlFor="brand">Brand</label>
                  <input id="brand" name="brand" placeholder="e.g. Nike, Custom" />
                </div>
              </div>

              {/* Group 3: Classification & Opening Stock */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label htmlFor="category">Category</label>
                  <input id="category" name="category" placeholder="e.g. Apparel, Swag, Tech" defaultValue="General" />
                </div>
                <div>
                  <label htmlFor="unit">Unit of Measure</label>
                  <input id="unit" name="unit" defaultValue="pcs" placeholder="pcs, roll, box" />
                </div>
                <div>
                  <label htmlFor="initialStock">Initial Stock</label>
                  <input
                    id="initialStock"
                    name="initialStock"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue="0"
                    placeholder="0"
                  />
                </div>
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
                  Initial opening stock balance will be safely posted to the immutable ledger with an auditable opening adjustment record.
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving Variant & Posting Stock..." : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
