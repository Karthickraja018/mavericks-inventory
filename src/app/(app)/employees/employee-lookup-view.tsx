"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export type EmployeeDetail = {
  id: string;
  empId: string;
  name: string;
  baseLocation: string;
  department: string | null;
  email: string | null;
  active: boolean;
  totalQuantity: number;
  uniqueItemCount: number;
  items: {
    itemId: string;
    sku: string;
    name: string;
    category: string;
    count: number;
    lastDistributed: string;
    recentEventName: string | null;
    recentRecipientType: string | null;
  }[];
  history: {
    id: string;
    date: string;
    itemName: string;
    sku: string;
    quantity: number;
    eventName: string | null;
    recipientType: string | null;
    poc: string | null;
  }[];
};

type ItemSummary = {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
};

export function EmployeeLookupView({
  employees,
  allItems,
  initialEmpId,
}: {
  employees: EmployeeDetail[];
  allItems: ItemSummary[];
  initialEmpId?: string;
}) {
  const [selectedId, setSelectedId] = useState<string>(
    initialEmpId
      ? employees.find((e) => e.empId.toLowerCase() === initialEmpId.toLowerCase() || e.id === initialEmpId)?.id || ""
      : employees[0]?.id || ""
  );
  const [search, setSearch] = useState<string>("");

  const filteredList = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter(
      (e) =>
        e.empId.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        (e.department && e.department.toLowerCase().includes(q)) ||
        e.baseLocation.toLowerCase().includes(q)
    );
  }, [search, employees]);

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedId);
  }, [selectedId, employees]);

  // Collect item IDs this employee has received
  const collectedIds = useMemo(() => {
    if (!selectedEmployee) return new Set<string>();
    return new Set(selectedEmployee.items.map((i) => i.itemId));
  }, [selectedEmployee]);

  // Goodies this employee has never received yet
  const uncollectedItems = useMemo(() => {
    return allItems.filter((i) => !collectedIds.has(i.id) && i.quantity > 0);
  }, [allItems, collectedIds]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 340px) minmax(0, 1fr)", gap: 20 }}>
      {/* Left Column: Quick Employee Selector / Search */}
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
          <span>🔍</span> Choose Employee
        </h3>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Search Emp ID, Name, Dept..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ maxHeight: 520, overflowY: "auto", display: "grid", gap: 6 }}>
          {filteredList.map((emp) => {
            const isSelected = emp.id === selectedId;
            return (
              <div
                key={emp.id}
                onClick={() => setSelectedId(emp.id)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: isSelected ? "var(--accent-soft)" : "var(--surface-subtle)",
                  border: isSelected ? "1px solid var(--accent)" : "1px solid var(--line)",
                  transition: "all .15s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <code style={{ fontSize: 11, fontWeight: 700, color: isSelected ? "var(--accent-dark)" : "var(--ink)" }}>
                    {emp.empId}
                  </code>
                  <span
                    className="badge"
                    style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      background: emp.totalQuantity > 0 ? "var(--success-soft)" : "var(--surface)",
                      color: emp.totalQuantity > 0 ? "var(--success)" : "var(--muted)",
                    }}
                  >
                    {emp.totalQuantity} items
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 13, marginTop: 2, color: "var(--ink)" }}>{emp.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  {emp.department ? `${emp.department} · ` : ""}
                  {emp.baseLocation}
                </div>
              </div>
            );
          })}
          {filteredList.length === 0 && (
            <div className="empty" style={{ padding: 20 }}>
              No matching employees.
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Selected Employee Item Profile & History */}
      <div>
        {selectedEmployee ? (
          <>
            {/* Header Card */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h2 style={{ margin: 0, fontSize: 20 }}>{selectedEmployee.name}</h2>
                    <code style={{ fontSize: 13, padding: "2px 6px", background: "var(--surface-subtle)", borderRadius: 4 }}>
                      {selectedEmployee.empId}
                    </code>
                    {selectedEmployee.active ? (
                      <span className="badge APPROVED">active</span>
                    ) : (
                      <span className="badge REJECTED">inactive</span>
                    )}
                  </div>
                  <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                    {selectedEmployee.department ? `Department: ${selectedEmployee.department} · ` : ""}
                    Base Location: <strong>{selectedEmployee.baseLocation}</strong>
                    {selectedEmployee.email ? ` · ${selectedEmployee.email}` : ""}
                  </p>
                </div>
                <Link href={`/events?empId=${selectedEmployee.empId}`}>
                  <button style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>🎁</span> Distribute Goodie
                  </button>
                </Link>
              </div>

              {/* Stat Pills */}
              <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                <div style={{ padding: "8px 14px", background: "var(--surface-subtle)", borderRadius: 6, border: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>Total Items Collected</span>
                  <strong style={{ fontSize: 18, color: "var(--ink)" }}>{selectedEmployee.totalQuantity}</strong>
                </div>
                <div style={{ padding: "8px 14px", background: "var(--surface-subtle)", borderRadius: 6, border: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>Unique Items</span>
                  <strong style={{ fontSize: 18, color: "var(--ink)" }}>{selectedEmployee.uniqueItemCount}</strong>
                </div>
                <div style={{ padding: "8px 14px", background: "var(--surface-subtle)", borderRadius: 6, border: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>Events Attended/Rewarded</span>
                  <strong style={{ fontSize: 18, color: "var(--ink)" }}>
                    {new Set(selectedEmployee.history.map((h) => h.eventName).filter(Boolean)).size}
                  </strong>
                </div>
              </div>
            </div>

            {/* Collected Items Breakdown Table */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Items Collected by {selectedEmployee.name} (with Count)</h3>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {selectedEmployee.items.length} distinct item variant(s)
                </span>
              </div>
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Item / Goodie</th>
                      <th>SKU</th>
                      <th>Category</th>
                      <th className="numeric">Count Collected</th>
                      <th>Latest Event</th>
                      <th>Role / Recognition</th>
                      <th>Last Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmployee.items.map((it) => (
                      <tr key={it.itemId}>
                        <td>
                          <strong>{it.name}</strong>
                        </td>
                        <td>
                          <code style={{ fontSize: 11 }}>{it.sku}</code>
                        </td>
                        <td>{it.category}</td>
                        <td className="numeric">
                          <span
                            className="badge"
                            style={{
                              background: "var(--accent-soft)",
                              color: "var(--accent-dark)",
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            × {it.count}
                          </span>
                        </td>
                        <td>{it.recentEventName || <span style={{ color: "var(--faint)" }}>General</span>}</td>
                        <td>
                          {it.recentRecipientType ? (
                            <span className="badge">{it.recentRecipientType}</span>
                          ) : (
                            <span style={{ color: "var(--faint)" }}>—</span>
                          )}
                        </td>
                        <td>
                          <small>{it.lastDistributed}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selectedEmployee.items.length === 0 && (
                  <div className="empty">This employee hasn't collected any items yet.</div>
                )}
              </div>
            </div>

            {/* Recommended Uncollected Goodies */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: "0 0 2px", fontSize: 15, color: "var(--success)" }}>
                    ✨ Recommended New Items (Not Yet Collected by {selectedEmployee.name})
                  </h3>
                  <small style={{ color: "var(--muted)" }}>
                    Give these fresh items next time instead of repeating previously collected goodies!
                  </small>
                </div>
              </div>
              {uncollectedItems.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                  {uncollectedItems.map((uItem) => (
                    <div
                      key={uItem.id}
                      style={{
                        padding: 10,
                        background: "var(--surface-subtle)",
                        borderRadius: 6,
                        border: "1px solid var(--line)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{uItem.name}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                          <code>{uItem.sku}</code> · Stock: <strong>{uItem.quantity}</strong>
                        </div>
                      </div>
                      <Link href={`/events?empId=${selectedEmployee.empId}`}>
                        <button className="ghost" style={{ fontSize: 11, padding: "2px 8px", minHeight: 26 }}>
                          + Give
                        </button>
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--muted)", padding: 8 }}>
                  Employee has received all active inventory items or remaining items are out of stock.
                </div>
              )}
            </div>

            {/* Distribution History Timeline Table */}
            {selectedEmployee.history.length > 0 && (
              <div className="card">
                <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Full Distribution Timeline</h3>
                <div className="scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Item</th>
                        <th>Quantity</th>
                        <th>Event</th>
                        <th>Role</th>
                        <th>POC / Executive</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEmployee.history.map((h) => (
                        <tr key={h.id}>
                          <td>
                            <small>{h.date}</small>
                          </td>
                          <td>
                            <code>{h.sku}</code> · {h.itemName}
                          </td>
                          <td className="numeric">
                            <strong>{h.quantity}</strong>
                          </td>
                          <td>{h.eventName || "—"}</td>
                          <td>{h.recipientType ? <span className="badge">{h.recipientType}</span> : "—"}</td>
                          <td>
                            <small>{h.poc || "—"}</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="card empty">Select an employee from the left panel to inspect their items and count.</div>
        )}
      </div>
    </div>
  );
}
