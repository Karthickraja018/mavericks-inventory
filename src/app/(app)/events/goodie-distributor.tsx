"use client";

import { useState, useMemo } from "react";
import { distributeGoodie } from "./actions";

type EmployeeOption = {
  id: string;
  empId: string;
  name: string;
  baseLocation: string;
  department: string | null;
  itemsCollected: {
    itemId: string;
    itemName: string;
    sku: string;
    count: number;
    events: string[];
    roles: string[];
    lastDate: string;
  }[];
};

type ItemOption = {
  id: string;
  sku: string;
  name: string;
  size: string;
  color: string;
  brand: string;
  category: string;
  quantity: number;
};

type EventOption = {
  id: string;
  name: string;
  category: string;
  date: string;
  status: string;
};

export function GoodieDistributor({
  employees,
  items,
  events,
  preselectedEmpId,
}: {
  employees: EmployeeOption[];
  items: ItemOption[];
  events: EventOption[];
  preselectedEmpId?: string;
}) {
  const [selectedEmpId, setSelectedEmpId] = useState<string>(preselectedEmpId || "");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string>(events[0]?.id || "");
  const [quantity, setQuantity] = useState<number>(1);
  const [recipientType, setRecipientType] = useState<string>("WINNER");
  const [notes, setNotes] = useState<string>("");

  // Find active selected employee
  const currentEmployee = useMemo(() => {
    if (!selectedEmpId) return null;
    return employees.find((e) => e.id === selectedEmpId || e.empId.toLowerCase() === selectedEmpId.toLowerCase());
  }, [selectedEmpId, employees]);

  // Map of item IDs already collected by this employee
  const collectedItemMap = useMemo(() => {
    if (!currentEmployee) return new Map<string, { count: number; itemName: string; events: string[] }>();
    const map = new Map<string, { count: number; itemName: string; events: string[] }>();
    currentEmployee.itemsCollected.forEach((c) => {
      map.set(c.itemId, { count: c.count, itemName: c.itemName, events: c.events });
    });
    return map;
  }, [currentEmployee]);

  // Selected item details
  const selectedItem = useMemo(() => {
    return items.find((i) => i.id === selectedItemId);
  }, [selectedItemId, items]);

  // Items never received by this employee (with stock > 0)
  const recommendedNewItems = useMemo(() => {
    if (!currentEmployee) return [];
    return items.filter((i) => !collectedItemMap.has(i.id) && i.quantity > 0);
  }, [currentEmployee, collectedItemMap, items]);

  // Duplicate warning check
  const duplicateWarning = useMemo(() => {
    if (!currentEmployee || !selectedItemId) return null;
    const history = collectedItemMap.get(selectedItemId);
    if (history) {
      return {
        alreadyGiven: true,
        count: history.count,
        itemName: history.itemName,
        events: history.events.filter(Boolean),
      };
    }
    return null;
  }, [currentEmployee, selectedItemId, collectedItemMap]);

  // Filtered employees for instant selector
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees.slice(0, 50);
    const q = searchQuery.toLowerCase();
    return employees
      .filter(
        (e) =>
          e.empId.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q) ||
          (e.department && e.department.toLowerCase().includes(q)) ||
          e.baseLocation.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [searchQuery, employees]);

  return (
    <div className="card distribution-panel" style={{ border: "1px solid var(--line-strong)", boxShadow: "var(--shadow-md)" }}>
      <div className="panel-header" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 18, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
              <span>🎁</span> Distribute Event Goodie
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              Reward event winners and participants while tracking goodie history to ensure employees receive fresh, unique items.
            </p>
          </div>
          <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent-dark)", fontWeight: 600 }}>
            Duplicate Prevention Active
          </span>
        </div>
      </div>

      <form action={distributeGoodie} style={{ display: "grid", gap: 20 }}>
        {/* Step 1 & 2 in grid: Event & Employee Selection */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {/* Event Picker */}
          <div>
            <label htmlFor="eventId" style={{ fontWeight: 600, color: "var(--ink)" }}>
              1. Select Event *
            </label>
            <select
              id="eventId"
              name="eventId"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              required
              style={{ fontWeight: 500 }}
            >
              <option value="">-- Choose an Event --</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.category} · {ev.date})
                </option>
              ))}
            </select>
            <small style={{ color: "var(--muted)", display: "block", marginTop: 4 }}>
              Links this gift to the official event record.
            </small>
          </div>

          {/* Recipient Role */}
          <div>
            <label htmlFor="recipientType" style={{ fontWeight: 600, color: "var(--ink)" }}>
              2. Participation / Recognition Type *
            </label>
            <select
              id="recipientType"
              name="recipientType"
              value={recipientType}
              onChange={(e) => setRecipientType(e.target.value)}
              required
            >
              <option value="WINNER">🏆 Event Winner (1st / Gold)</option>
              <option value="RUNNER_UP">🥈 Runner-Up (2nd / Silver)</option>
              <option value="PARTICIPANT">🎖️ Event Participant</option>
              <option value="SPECIAL_RECOGNITION">⭐ Special Recognition / MVP</option>
              <option value="ORGANIZER">🤝 Event Volunteer / Organizer</option>
            </select>
            <small style={{ color: "var(--muted)", display: "block", marginTop: 4 }}>
              Differentiates winner trophies/goodies from participation swag.
            </small>
          </div>
        </div>

        {/* Step 3: Employee Lookup & Selection */}
        <div style={{ background: "var(--surface-subtle)", padding: 16, borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <label htmlFor="employeeSearch" style={{ fontWeight: 600, color: "var(--ink)", margin: 0 }}>
              3. Choose Employee (by Emp ID or Name) *
            </label>
            {currentEmployee && (
              <span className="badge APPROVED" style={{ fontSize: 11 }}>
                Selected: {currentEmployee.empId} — {currentEmployee.name}
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 8 }}>
            <input
              id="employeeSearch"
              type="text"
              placeholder="Type Emp ID (e.g. E001) or Name to search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="ghost"
                onClick={() => setSearchQuery("")}
                style={{ padding: "0 12px", minHeight: 36 }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Dropdown list of matched employees */}
          <select
            name="employeeId"
            value={currentEmployee?.id || ""}
            onChange={(e) => setSelectedEmpId(e.target.value)}
            required
            style={{ fontWeight: 500 }}
          >
            <option value="">-- Select Employee --</option>
            {filteredEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.empId} · {e.name} {e.department ? `(${e.department})` : ""} · {e.baseLocation}
              </option>
            ))}
          </select>

          {/* Employee Collected Items & History Panel */}
          {currentEmployee && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                background: "var(--surface)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--line)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                <div>
                  <strong style={{ fontSize: 15, color: "var(--ink)", display: "block" }}>
                    {currentEmployee.name} <code style={{ fontSize: 12, marginLeft: 6 }}>{currentEmployee.empId}</code>
                  </strong>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {currentEmployee.department ? `${currentEmployee.department} · ` : ""}
                    Location: {currentEmployee.baseLocation}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span className="badge" style={{ background: "var(--surface-subtle)" }}>
                    Total Goodies: <strong>{currentEmployee.itemsCollected.reduce((acc, c) => acc + c.count, 0)}</strong>
                  </span>
                  <span className="badge" style={{ background: "var(--surface-subtle)" }}>
                    Unique Items: <strong>{currentEmployee.itemsCollected.length}</strong>
                  </span>
                </div>
              </div>

              {/* Already Received Items */}
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                  Items Already Collected by this Employee:
                </span>
                {currentEmployee.itemsCollected.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--success)", fontWeight: 500 }}>
                    ✨ This employee has not collected any items yet. All inventory goodies are new for them!
                  </p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {currentEmployee.itemsCollected.map((c) => (
                      <span
                        key={c.itemId}
                        className="badge"
                        style={{
                          background: "#fff",
                          border: "1px solid var(--line-strong)",
                          padding: "4px 10px",
                          fontSize: 12,
                          color: "var(--ink-soft)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span>📦</span>
                        <strong>{c.itemName}</strong>
                        <span
                          style={{
                            background: "var(--accent-soft)",
                            color: "var(--accent-dark)",
                            borderRadius: 999,
                            padding: "1px 6px",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          ×{c.count}
                        </span>
                        {c.events.length > 0 && (
                          <small style={{ color: "var(--muted)", fontSize: 10 }}>({c.events.slice(0, 1).join("")})</small>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Recommended New Goodies (Never Received) */}
              {recommendedNewItems.length > 0 && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                    ⭐ Recommended New Items (Employee Never Received Yet):
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {recommendedNewItems.slice(0, 8).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedItemId(item.id)}
                        className="ghost"
                        style={{
                          fontSize: 12,
                          padding: "4px 9px",
                          minHeight: 28,
                          borderRadius: 6,
                          borderColor: selectedItemId === item.id ? "var(--accent)" : "var(--line)",
                          background: selectedItemId === item.id ? "var(--accent-soft)" : "var(--surface)",
                          color: selectedItemId === item.id ? "var(--accent-dark)" : "var(--ink)",
                          fontWeight: selectedItemId === item.id ? 700 : 500,
                          cursor: "pointer",
                        }}
                        title={`Click to select ${item.name} (Stock: ${item.quantity})`}
                      >
                        + {item.name} <small style={{ color: "var(--muted)", marginLeft: 3 }}>({item.quantity} in stock)</small>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 4: Goodie Item Selection & Quantity */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          <div>
            <label htmlFor="itemId" style={{ fontWeight: 600, color: "var(--ink)" }}>
              4. Goodie Item to Distribute *
            </label>
            <select
              id="itemId"
              name="itemId"
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              required
              style={{ fontWeight: 500 }}
            >
              <option value="">-- Choose Item from Inventory --</option>
              {items.map((i) => {
                const isCollected = collectedItemMap.has(i.id);
                const outOfStock = i.quantity <= 0;
                return (
                  <option key={i.id} value={i.id} disabled={outOfStock}>
                    {i.sku} · {i.name}
                    {i.size ? ` (${i.size})` : ""}
                    {i.color ? ` - ${i.color}` : ""}
                    {outOfStock ? " [OUT OF STOCK]" : ` [Stock: ${i.quantity}]`}
                    {isCollected ? ` [⚠️ Already Given ×${collectedItemMap.get(i.id)?.count}]` : " [✨ NEW FOR EMPLOYEE]"}
                  </option>
                );
              })}
            </select>

            {/* DUPLICATE WARNING CALLOUT */}
            {duplicateWarning && (
              <div
                className="err"
                style={{
                  marginTop: 10,
                  marginBottom: 0,
                  background: "#fffbeb",
                  borderColor: "#fde68a",
                  color: "#92400e",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  fontSize: 13,
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
                <div>
                  <strong>Duplicate Item Notice:</strong> {currentEmployee?.name} has already collected{" "}
                  <strong>
                    {duplicateWarning.itemName} (count: {duplicateWarning.count})
                  </strong>
                  .
                  <div style={{ marginTop: 4, fontSize: 12, color: "#b45309" }}>
                    To ensure the employee receives a new item, pick an item marked with{" "}
                    <strong>✨ NEW FOR EMPLOYEE</strong> above or click one from the recommended list.
                  </div>
                </div>
              </div>
            )}

            {/* Fresh Item Confirmation Callout */}
            {!duplicateWarning && selectedItem && currentEmployee && (
              <div
                className="ok"
                style={{
                  marginTop: 10,
                  marginBottom: 0,
                  padding: "8px 12px",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>✨</span>
                <span>
                  Great choice! <strong>{currentEmployee.name}</strong> has never received <strong>{selectedItem.name}</strong> before.
                </span>
              </div>
            )}
          </div>

          {/* Quantity & Stock Check */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <label htmlFor="quantity" style={{ fontWeight: 600, color: "var(--ink)" }}>
                5. Quantity *
              </label>
              {selectedItem && (
                <small style={{ color: selectedItem.quantity > 0 ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                  Available in Stock: {selectedItem.quantity}
                </small>
              )}
            </div>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              max={selectedItem ? Math.max(1, selectedItem.quantity) : 100}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              required
            />
            <small style={{ color: "var(--muted)", display: "block", marginTop: 4 }}>
              Typically 1 goodie per winner/participant. Stock will be automatically deducted.
            </small>
          </div>
        </div>

        {/* Notes / Special Remarks */}
        <div>
          <label htmlFor="notes" style={{ fontWeight: 600, color: "var(--ink)" }}>
            6. Executive Notes / Event Remarks (Optional)
          </label>
          <input
            id="notes"
            name="notes"
            placeholder="e.g. 1st Place Coding Hackathon, Best Project Innovation, etc."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Submit Button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            {selectedItem && currentEmployee && (
              <span>
                Distributing <strong>{quantity}× {selectedItem.name}</strong> to <strong>{currentEmployee.name}</strong>
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={!currentEmployee || !selectedItemId || !selectedEventId || (selectedItem && selectedItem.quantity < quantity)}
            style={{
              padding: "8px 24px",
              fontSize: 14,
              fontWeight: 600,
              background: duplicateWarning ? "var(--warning)" : "var(--accent)",
              borderColor: duplicateWarning ? "var(--warning)" : "var(--accent)",
            }}
          >
            {duplicateWarning ? "Confirm & Distribute (Duplicate)" : "Confirm & Distribute Goodie"}
          </button>
        </div>
      </form>
    </div>
  );
}
