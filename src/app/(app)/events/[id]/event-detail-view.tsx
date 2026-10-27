"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Trophy,
  Users,
  Gift,
  Clock,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  Calendar,
  MapPin,
  Tag,
  ArrowRight,
  Download,
  Upload,
  RefreshCw,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { toggleEventStatus, upsertEventRecipientAndDistribute, previewEventRecipientsFile, executeEventRecipientsBulkImport } from "../actions";

export type EventDetailData = {
  id: string;
  name: string;
  category: string;
  dateStr: string;
  rawDate: string;
  location: string | null;
  description: string | null;
  status: string;
  uniqueRecipients: number;
  recipientRecords: number;
  itemLines: number;
  totalUnitsDistributed: number;
  distributions: {
    id: string;
    employeeId: string;
    empId: string;
    employeeName: string;
    employeeLocation: string;
    employeeDept: string | null;
    itemId: string;
    itemSku: string;
    itemName: string;
    quantity: number;
    recipientType: string;
    status: string;
    movementId: string | null;
    distributionDate: string;
    notes: string | null;
    sourceRef: string | null;
  }[];
  requests: {
    id: string;
    number: number;
    requesterName: string;
    employeeId: string | null;
    employeeName: string | null;
    status: string;
    purpose: string;
    submittedAt: string | null;
    lines: {
      id: string;
      itemId: string;
      itemName: string;
      quantity: number;
    }[];
  }[];
  stockMovements: {
    id: string;
    itemSku: string;
    itemName: string;
    change: number;
    balanceAfter: number;
    actorName: string;
    createdAt: string;
    reason: string | null;
  }[];
};

export type AvailableItem = {
  id: string;
  sku: string;
  name: string;
  size: string;
  color: string;
  brand: string;
  category: string;
  unit: string;
  quantity: number;
};

export type AvailableEmployee = {
  id: string;
  empId: string;
  name: string;
  baseLocation: string;
  department: string | null;
  email: string | null;
  collectedItemIds: string[];
};

export function EventDetailView({
  event,
  items,
  employees,
  userRole,
}: {
  event: EventDetailData;
  items: AvailableItem[];
  employees: AvailableEmployee[];
  userRole: string;
}) {
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "RECIPIENTS" | "DISTRIBUTE" | "APPROVALS" | "IMPORT">("OVERVIEW");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientRoleFilter, setRecipientRoleFilter] = useState("ALL");
  const [recipientStatusFilter, setRecipientStatusFilter] = useState("ALL");
  const [isAddRecipientOpen, setIsAddRecipientOpen] = useState(false);

  // Group distributions by employee for the Recipients & Winners table
  const groupedRecipients = useMemo(() => {
    const map = new Map<
      string,
      {
        employeeId: string;
        empId: string;
        name: string;
        location: string;
        dept: string | null;
        role: string;
        items: { id: string; name: string; sku: string; quantity: number; status: string }[];
        totalUnits: number;
        hasPending: boolean;
        hasPosted: boolean;
        hasRejected: boolean;
        lastDate: string;
      }
    >();

    event.distributions.forEach((d) => {
      const existing = map.get(d.employeeId);
      if (existing) {
        existing.items.push({
          id: d.id,
          name: d.itemName,
          sku: d.itemSku,
          quantity: d.quantity,
          status: d.status,
        });
        existing.totalUnits += d.quantity;
        if (d.status === "PENDING_APPROVAL") existing.hasPending = true;
        if (d.status === "POSTED") existing.hasPosted = true;
        if (d.status === "REJECTED") existing.hasRejected = true;
      } else {
        map.set(d.employeeId, {
          employeeId: d.employeeId,
          empId: d.empId,
          name: d.employeeName,
          location: d.employeeLocation,
          dept: d.employeeDept,
          role: d.recipientType || "PARTICIPANT",
          items: [
            {
              id: d.id,
              name: d.itemName,
              sku: d.itemSku,
              quantity: d.quantity,
              status: d.status,
            },
          ],
          totalUnits: d.quantity,
          hasPending: d.status === "PENDING_APPROVAL",
          hasPosted: d.status === "POSTED",
          hasRejected: d.status === "REJECTED",
          lastDate: d.distributionDate,
        });
      }
    });

    return Array.from(map.values());
  }, [event.distributions]);

  // Filtered recipients
  const filteredRecipients = useMemo(() => {
    return groupedRecipients.filter((r) => {
      const matchSearch =
        !recipientSearch ||
        r.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
        r.empId.toLowerCase().includes(recipientSearch.toLowerCase()) ||
        (r.dept && r.dept.toLowerCase().includes(recipientSearch.toLowerCase())) ||
        r.items.some((i) => i.name.toLowerCase().includes(recipientSearch.toLowerCase()));

      const matchRole = recipientRoleFilter === "ALL" || r.role === recipientRoleFilter;

      let matchStatus = true;
      if (recipientStatusFilter === "POSTED") matchStatus = r.hasPosted;
      if (recipientStatusFilter === "PENDING") matchStatus = r.hasPending;
      if (recipientStatusFilter === "REJECTED") matchStatus = r.hasRejected;

      return matchSearch && matchRole && matchStatus;
    });
  }, [groupedRecipients, recipientSearch, recipientRoleFilter, recipientStatusFilter]);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Tab Navigation */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--line)",
          gap: 24,
          paddingBottom: 0,
          overflowX: "auto",
        }}
      >
        <button
          onClick={() => setActiveTab("OVERVIEW")}
          className="ghost"
          style={{
            borderRadius: 0,
            borderBottom: activeTab === "OVERVIEW" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "OVERVIEW" ? "var(--accent)" : "var(--muted)",
            fontWeight: activeTab === "OVERVIEW" ? 700 : 500,
            padding: "8px 4px 12px",
            minHeight: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Layers size={15} /> Overview
        </button>

        <button
          onClick={() => setActiveTab("RECIPIENTS")}
          className="ghost"
          style={{
            borderRadius: 0,
            borderBottom: activeTab === "RECIPIENTS" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "RECIPIENTS" ? "var(--accent)" : "var(--muted)",
            fontWeight: activeTab === "RECIPIENTS" ? 700 : 500,
            padding: "8px 4px 12px",
            minHeight: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Trophy size={15} /> Recipients & Winners
          <span
            style={{
              fontSize: 11,
              padding: "1px 6px",
              borderRadius: 10,
              background: "var(--surface-subtle)",
              color: "var(--foreground)",
            }}
          >
            {groupedRecipients.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("DISTRIBUTE")}
          className="ghost"
          style={{
            borderRadius: 0,
            borderBottom: activeTab === "DISTRIBUTE" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "DISTRIBUTE" ? "var(--accent)" : "var(--muted)",
            fontWeight: activeTab === "DISTRIBUTE" ? 700 : 500,
            padding: "8px 4px 12px",
            minHeight: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Gift size={15} /> Goodies Distribution
        </button>

        <button
          onClick={() => setActiveTab("APPROVALS")}
          className="ghost"
          style={{
            borderRadius: 0,
            borderBottom: activeTab === "APPROVALS" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "APPROVALS" ? "var(--accent)" : "var(--muted)",
            fontWeight: activeTab === "APPROVALS" ? 700 : 500,
            padding: "8px 4px 12px",
            minHeight: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Clock size={15} /> Approvals & History
          {event.requests.filter((r) => r.status.includes("PENDING")).length > 0 && (
            <span
              style={{
                fontSize: 10.5,
                padding: "1px 6px",
                borderRadius: 10,
                background: "var(--warning)",
                color: "white",
                fontWeight: 700,
              }}
            >
              {event.requests.filter((r) => r.status.includes("PENDING")).length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("IMPORT")}
          className="ghost"
          style={{
            borderRadius: 0,
            borderBottom: activeTab === "IMPORT" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "IMPORT" ? "var(--accent)" : "var(--muted)",
            fontWeight: activeTab === "IMPORT" ? 700 : 500,
            padding: "8px 4px 12px",
            minHeight: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <FileSpreadsheet size={15} /> Bulk Spreadsheet Import
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 1: OVERVIEW */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "OVERVIEW" && (
        <div style={{ display: "grid", gap: 20 }}>
          {/* Event Status and Meta Banner */}
          <div
            className="card"
            style={{
              margin: 0,
              padding: "20px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--accent)",
                    background: "rgba(37, 99, 235, 0.08)",
                    padding: "3px 10px",
                    borderRadius: 4,
                  }}
                >
                  {event.category}
                </span>
                <StatusBadge status={event.status} size="sm" />
              </div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{event.name}</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13, color: "var(--muted)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Calendar size={13} /> {event.dateStr}
                </span>
                {event.location && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <MapPin size={13} /> {event.location}
                  </span>
                )}
              </div>
              {event.description && (
                <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--foreground-muted)", maxWidth: 700 }}>
                  {event.description}
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <form action={toggleEventStatus}>
                <input type="hidden" name="id" value={event.id} />
                <input type="hidden" name="status" value={event.status} />
                <button
                  type="submit"
                  className="ghost"
                  style={{
                    fontSize: 12.5,
                    minHeight: 32,
                    borderColor: "var(--line)",
                  }}
                >
                  Mark as {event.status === "ACTIVE" ? "Completed" : "Active"}
                </button>
              </form>
              <button
                onClick={() => setActiveTab("DISTRIBUTE")}
                style={{ fontSize: 12.5, minHeight: 32, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Gift size={14} /> Distribute Goodies
              </button>
            </div>
          </div>

          {/* Event-Level Authoritative Statistics Row */}
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
              Event Statistics & Impact
            </h3>
            <div className="grid">
              <KpiCard
                label="Unique Recipients"
                value={event.uniqueRecipients}
                subtext="Distinct staff recognized"
                icon={Users}
              />
              <KpiCard
                label="Recipient Records"
                value={event.recipientRecords}
                subtext="Total distribution records"
                icon={Trophy}
              />
              <KpiCard
                label="Item Lines"
                value={event.itemLines}
                subtext="Unique goodie SKUs"
                icon={Layers}
              />
              <KpiCard
                label="Total Units Distributed"
                value={`${event.totalUnitsDistributed} pcs`}
                subtext="Authoritative posted deductions"
                icon={Gift}
                variant="success"
              />
            </div>
          </div>

          {/* Quick Action Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <div
              className="card metric-link"
              onClick={() => {
                setActiveTab("RECIPIENTS");
                setIsAddRecipientOpen(true);
              }}
              style={{ cursor: "pointer", margin: 0, padding: 18 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ padding: 8, borderRadius: 8, background: "rgba(37, 99, 235, 0.1)", color: "var(--accent)" }}>
                  <Plus size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: 14, display: "block" }}>Add Event Recipient</strong>
                  <small style={{ color: "var(--muted)" }}>Search existing or enroll new employee</small>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--foreground-muted)" }}>
                Associate a staff member with a recognition tier (Winner, Runner-up, Participant) and select goodies.
              </p>
            </div>

            <div
              className="card metric-link"
              onClick={() => setActiveTab("DISTRIBUTE")}
              style={{ cursor: "pointer", margin: 0, padding: 18 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ padding: 8, borderRadius: 8, background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}>
                  <Gift size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: 14, display: "block" }}>Distribute Goodies</strong>
                  <small style={{ color: "var(--muted)" }}>Submit request or direct dispatch</small>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--foreground-muted)" }}>
                Multi-line inventory allocation with duplicate warning badges and real-time stock balance deduction.
              </p>
            </div>

            <div
              className="card metric-link"
              onClick={() => setActiveTab("IMPORT")}
              style={{ cursor: "pointer", margin: 0, padding: 18 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ padding: 8, borderRadius: 8, background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" }}>
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: 14, display: "block" }}>Bulk Excel Import</strong>
                  <small style={{ color: "var(--muted)" }}>Upload spreadsheet of winners</small>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--foreground-muted)" }}>
                Validate spreadsheet rows, preview employee upserts, check stock levels, and commit without duplicates.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SECTION 2: RECIPIENTS & WINNERS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "RECIPIENTS" && (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Toolbar */}
          <div
            className="card"
            style={{
              margin: 0,
              padding: "14px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ position: "relative", minWidth: 260, flex: 1 }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--muted)",
                }}
              />
              <input
                type="text"
                placeholder="Search recipient by name, Emp ID, or item..."
                value={recipientSearch}
                onChange={(e) => setRecipientSearch(e.target.value)}
                style={{ paddingLeft: 34, height: 34, width: "100%", fontSize: 13 }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <select
                value={recipientRoleFilter}
                onChange={(e) => setRecipientRoleFilter(e.target.value)}
                style={{ height: 34, fontSize: 13 }}
              >
                <option value="ALL">All Recognition Roles</option>
                <option value="WINNER">Winners</option>
                <option value="RUNNER_UP">Runners Up</option>
                <option value="PARTICIPANT">Participants</option>
                <option value="SPECIAL_RECOGNITION">Special Recognition</option>
              </select>

              <select
                value={recipientStatusFilter}
                onChange={(e) => setRecipientStatusFilter(e.target.value)}
                style={{ height: 34, fontSize: 13 }}
              >
                <option value="ALL">All Distribution Statuses</option>
                <option value="POSTED">Posted (Stock Deducted)</option>
                <option value="PENDING">Pending Approval</option>
                <option value="REJECTED">Rejected</option>
              </select>

              <button
                onClick={() => setIsAddRecipientOpen(true)}
                style={{ height: 34, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Plus size={14} /> Add Recipient
              </button>
            </div>
          </div>

          {/* Recipients Table */}
          <div className="card" style={{ margin: 0, padding: 0 }}>
            <div className="table-container">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-subtle)", borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: "12px 18px", textAlign: "left", fontSize: 12, fontWeight: 650 }}>Employee</th>
                    <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, fontWeight: 650 }}>Role</th>
                    <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, fontWeight: 650 }}>Awarded Goodies</th>
                    <th style={{ padding: "12px 14px", textAlign: "right", fontSize: 12, fontWeight: 650 }}>Total Units</th>
                    <th style={{ padding: "12px 14px", textAlign: "center", fontSize: 12, fontWeight: 650 }}>Status</th>
                    <th style={{ padding: "12px 18px", textAlign: "right", fontSize: 12, fontWeight: 650 }}>Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecipients.map((r) => (
                    <tr key={r.employeeId} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--foreground)" }}>
                            {r.name}
                          </span>
                          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                            <code>{r.empId}</code> {r.dept ? `• ${r.dept}` : ""} {r.location ? `• ${r.location}` : ""}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: "14px 14px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background:
                              r.role === "WINNER"
                                ? "rgba(245, 158, 11, 0.15)"
                                : r.role === "RUNNER_UP"
                                ? "rgba(59, 130, 246, 0.15)"
                                : "var(--surface-subtle)",
                            color:
                              r.role === "WINNER"
                                ? "#d97706"
                                : r.role === "RUNNER_UP"
                                ? "#2563eb"
                                : "var(--foreground-muted)",
                          }}
                        >
                          {r.role.replace(/_/g, " ")}
                        </span>
                      </td>

                      <td style={{ padding: "14px 14px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {r.items.map((it) => (
                            <span
                              key={it.id}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "3px 8px",
                                borderRadius: 6,
                                background: "var(--surface-subtle)",
                                border: "1px solid var(--line)",
                                fontSize: 11.5,
                              }}
                            >
                              <strong>{it.quantity}x</strong> {it.name}
                              <small style={{ color: "var(--muted)" }}>({it.sku})</small>
                            </span>
                          ))}
                        </div>
                      </td>

                      <td style={{ padding: "14px 14px", textAlign: "right", fontWeight: 700, fontSize: 13 }}>
                        {r.totalUnits} pcs
                      </td>

                      <td style={{ padding: "14px 14px", textAlign: "center" }}>
                        {r.hasPending ? (
                          <span className="badge PENDING" style={{ fontSize: 11 }}>
                            Pending Approval
                          </span>
                        ) : r.hasRejected ? (
                          <span className="badge REJECTED" style={{ fontSize: 11 }}>
                            Rejected
                          </span>
                        ) : r.hasPosted ? (
                          <span className="badge APPROVED" style={{ fontSize: 11 }}>
                            Posted & Deducted
                          </span>
                        ) : (
                          <span className="badge DRAFT" style={{ fontSize: 11 }}>
                            Draft
                          </span>
                        )}
                      </td>

                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <Link href={`/employees?empId=${encodeURIComponent(r.empId)}`}>
                          <button className="ghost" style={{ fontSize: 11.5, padding: "3px 8px", minHeight: 26 }}>
                            History →
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {!filteredRecipients.length && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
                        <p style={{ margin: 0, fontSize: 14 }}>No recipients found for this filter.</p>
                        <p style={{ margin: "4px 0 0", fontSize: 12 }}>
                          Use "Add Recipient" or "Bulk Spreadsheet Import" to add winners and participants.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SECTION 3: GOODIES DISTRIBUTION */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "DISTRIBUTE" && (
        <GoodiesDistributionForm
          event={event}
          items={items}
          employees={employees}
          userRole={userRole}
          onSuccess={() => setActiveTab("RECIPIENTS")}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* SECTION 4: APPROVALS & HISTORY */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "APPROVALS" && (
        <div style={{ display: "grid", gap: 20 }}>
          {/* Requests Section */}
          <div className="card" style={{ margin: 0, padding: 0 }}>
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={16} style={{ color: "var(--accent)" }} />
                <strong style={{ fontSize: 14 }}>Approval Workflow Requests for this Event</strong>
              </div>
              <small style={{ color: "var(--muted)" }}>{event.requests.length} total request(s)</small>
            </div>

            <div className="table-container">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-subtle)", borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: "10px 18px", textAlign: "left", fontSize: 12 }}>Request #</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Requester</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Recipient</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Goodies Requested</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 12 }}>Workflow Status</th>
                    <th style={{ padding: "10px 18px", textAlign: "right", fontSize: 12 }}>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {event.requests.map((req) => (
                    <tr key={req.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px 18px" }}>
                        <Link href={`/requests/${req.id}`}>
                          <code style={{ fontWeight: 700, color: "var(--accent)" }}>
                            REQ-{String(req.number).padStart(5, "0")}
                          </code>
                        </Link>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 13 }}>{req.requesterName}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 550 }}>
                        {req.employeeName || "Event Allocation"}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12 }}>
                        {req.lines.map((l) => `${l.quantity}x ${l.itemName}`).join(", ")}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <StatusBadge status={req.status} size="sm" />
                      </td>
                      <td style={{ padding: "12px 18px", textAlign: "right" }}>
                        <Link href={`/requests/${req.id}`}>
                          <button className="ghost" style={{ fontSize: 11.5, padding: "3px 8px", minHeight: 26 }}>
                            View Request →
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {!event.requests.length && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>
                        No formal approval requests submitted for this event yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stock Movements Ledger Section */}
          <div className="card" style={{ margin: 0, padding: 0 }}>
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={16} style={{ color: "#16a34a" }} />
                <strong style={{ fontSize: 14 }}>Authoritative Stock Movements Ledger</strong>
              </div>
              <small style={{ color: "var(--muted)" }}>Stock deducted only upon approval / direct dispatch</small>
            </div>

            <div className="table-container">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-subtle)", borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: "10px 18px", textAlign: "left", fontSize: 12 }}>Timestamp</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Item & SKU</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 12 }}>Deduction</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 12 }}>Balance After</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Authorized Actor</th>
                    <th style={{ padding: "10px 18px", textAlign: "left", fontSize: 12 }}>Reason & Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {event.stockMovements.map((move) => (
                    <tr key={move.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px 18px", fontSize: 12, color: "var(--muted)" }}>
                        {move.createdAt}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{move.itemName}</div>
                        <code style={{ fontSize: 11 }}>{move.itemSku}</code>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: "#dc2626" }}>
                        {move.change} pcs
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600 }}>
                        {move.balanceAfter}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12.5 }}>{move.actorName}</td>
                      <td style={{ padding: "12px 18px", fontSize: 12, color: "var(--foreground-muted)" }}>
                        {move.reason || "Event Goodie Distribution"}
                      </td>
                    </tr>
                  ))}

                  {!event.stockMovements.length && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>
                        No stock movement ledger transactions posted for this event yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SECTION 5: BULK SPREADSHEET IMPORT (OBJECTIVE C) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "IMPORT" && (
        <BulkRecipientsImportView eventId={event.id} userRole={userRole} onComplete={() => setActiveTab("RECIPIENTS")} />
      )}

      {/* Modal: Add Recipient Dialog */}
      {isAddRecipientOpen && (
        <AddRecipientModal
          eventId={event.id}
          eventName={event.name}
          items={items}
          employees={employees}
          userRole={userRole}
          onClose={() => setIsAddRecipientOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component: Goodies Distribution Form (Multi-line, Safe Upsert, Draft/Approve)
// ---------------------------------------------------------------------------
function GoodiesDistributionForm({
  event,
  items,
  employees,
  userRole,
  onSuccess,
}: {
  event: EventDetailData;
  items: AvailableItem[];
  employees: AvailableEmployee[];
  userRole: string;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [empSearch, setEmpSearch] = useState("");
  const [newEmpId, setNewEmpId] = useState("");
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("HQ");
  const [newDept, setNewDept] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [recipientType, setRecipientType] = useState<string>("WINNER");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<{ itemId: string; quantity: number }[]>([
    { itemId: items[0]?.id || "", quantity: 1 },
  ]);

  const activeEmployee = useMemo(() => {
    if (mode === "NEW") return null;
    return employees.find((e) => e.empId === selectedEmpId || e.id === selectedEmpId);
  }, [mode, selectedEmpId, employees]);

  const filteredEmployeeOptions = useMemo(() => {
    if (!empSearch) return employees.slice(0, 50);
    const q = empSearch.toLowerCase();
    return employees
      .filter((e) => e.name.toLowerCase().includes(q) || e.empId.toLowerCase().includes(q))
      .slice(0, 50);
  }, [employees, empSearch]);

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const addLine = () => {
    setLines([...lines, { itemId: items[0]?.id || "", quantity: 1 }]);
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: "itemId" | "quantity", value: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    setLines(updated);
  };

  return (
    <div className="card" style={{ margin: 0, padding: 24, maxWidth: 860 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Distribute Goodies for {event.name}</h3>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--muted)" }}>
        Allocate event goodies. Authorized users can distribute directly or submit to managerial approval workflows.
      </p>

      <form action={upsertEventRecipientAndDistribute}>
        <input type="hidden" name="eventId" value={event.id} />
        <input type="hidden" name="itemsJson" value={JSON.stringify(lines)} />

        <div style={{ display: "grid", gap: 18 }}>
          {/* Employee Selection Mode */}
          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>
              Recipient Identity
            </label>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  cursor: "pointer",
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: mode === "EXISTING" ? "var(--accent-soft)" : "var(--surface-subtle)",
                  border: mode === "EXISTING" ? "1px solid var(--accent)" : "1px solid var(--line)",
                  fontWeight: mode === "EXISTING" ? 650 : 400,
                }}
              >
                <input
                  type="radio"
                  name="empMode"
                  checked={mode === "EXISTING"}
                  onChange={() => setMode("EXISTING")}
                  style={{ display: "none" }}
                />
                Search Existing Employee
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  cursor: "pointer",
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: mode === "NEW" ? "var(--accent-soft)" : "var(--surface-subtle)",
                  border: mode === "NEW" ? "1px solid var(--accent)" : "1px solid var(--line)",
                  fontWeight: mode === "NEW" ? 650 : 400,
                }}
              >
                <input
                  type="radio"
                  name="empMode"
                  checked={mode === "NEW"}
                  onChange={() => setMode("NEW")}
                  style={{ display: "none" }}
                />
                Enroll New Employee
              </label>
            </div>

            {mode === "EXISTING" ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="text"
                    placeholder="Search staff by Name or Emp ID..."
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    style={{ flex: 1, height: 36, fontSize: 13 }}
                  />
                  <select
                    name="empId"
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    required
                    style={{ flex: 2, height: 36, fontSize: 13 }}
                  >
                    <option value="">Select Employee...</option>
                    {filteredEmployeeOptions.map((e) => (
                      <option key={e.id} value={e.empId}>
                        {e.empId} — {e.name} ({e.baseLocation || "HQ"})
                      </option>
                    ))}
                  </select>
                </div>

                {activeEmployee && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 6,
                      background: "var(--surface-subtle)",
                      border: "1px solid var(--line)",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <strong>{activeEmployee.name}</strong> • <code>{activeEmployee.empId}</code> •{" "}
                      {activeEmployee.department || "No Department"} • {activeEmployee.baseLocation}
                    </div>
                    <span style={{ color: "var(--muted)" }}>
                      {activeEmployee.collectedItemIds.length} item types already received
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
                    Employee ID *
                  </label>
                  <input
                    type="text"
                    name="empId"
                    required
                    placeholder="e.g. EMP-999"
                    value={newEmpId}
                    onChange={(e) => setNewEmpId(e.target.value.toUpperCase())}
                    style={{ width: "100%", height: 36, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. John Doe"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    style={{ width: "100%", height: 36, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
                    Base Location
                  </label>
                  <input
                    type="text"
                    name="baseLocation"
                    placeholder="HQ / Chennai / Remote"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    style={{ width: "100%", height: 36, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
                    Department
                  </label>
                  <input
                    type="text"
                    name="department"
                    placeholder="Engineering / Sales"
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    style={{ width: "100%", height: 36, fontSize: 13 }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Recognition Role & Notes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                Recognition Role
              </label>
              <select
                name="recipientType"
                value={recipientType}
                onChange={(e) => setRecipientType(e.target.value)}
                style={{ width: "100%", height: 36, fontSize: 13 }}
              >
                <option value="WINNER">Winner (1st Place)</option>
                <option value="RUNNER_UP">Runner-Up</option>
                <option value="PARTICIPANT">Participant</option>
                <option value="SPECIAL_RECOGNITION">Special Recognition</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                Distribution Notes / Citation
              </label>
              <input
                type="text"
                name="notes"
                placeholder="e.g. Outstanding project performance in finals"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: "100%", height: 36, fontSize: 13 }}
              />
            </div>
          </div>

          {/* Item Lines Section */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Goodies Items & Quantities</label>
              <button
                type="button"
                className="ghost"
                onClick={addLine}
                style={{ fontSize: 12, padding: "2px 8px", minHeight: 28, display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <Plus size={13} /> Add Line Item
              </button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {lines.map((line, idx) => {
                const item = itemMap.get(line.itemId);
                const isDuplicate = activeEmployee?.collectedItemIds.includes(line.itemId);
                const hasStock = item ? item.quantity >= line.quantity : false;

                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: 10,
                      borderRadius: 6,
                      background: "var(--surface-subtle)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <div style={{ flex: 3 }}>
                      <select
                        value={line.itemId}
                        onChange={(e) => updateLine(idx, "itemId", e.target.value)}
                        style={{ width: "100%", height: 34, fontSize: 13 }}
                      >
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.sku}) — {it.quantity} {it.unit} available
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ width: 100 }}>
                      <input
                        type="number"
                        min="1"
                        max={item ? Math.max(1, item.quantity) : 999}
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, "quantity", Math.max(1, parseInt(e.target.value, 10) || 1))}
                        style={{ width: "100%", height: 34, fontSize: 13 }}
                      />
                    </div>

                    <div style={{ flex: 2, display: "flex", alignItems: "center", gap: 6 }}>
                      {isDuplicate && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "rgba(245, 158, 11, 0.15)",
                            color: "#d97706",
                            fontWeight: 650,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <AlertTriangle size={11} /> Previously Received
                        </span>
                      )}
                      {!hasStock && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "rgba(239, 68, 68, 0.15)",
                            color: "#dc2626",
                            fontWeight: 650,
                          }}
                        >
                          Insufficient Stock
                        </span>
                      )}
                    </div>

                    {lines.length > 1 && (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => removeLine(idx)}
                        style={{ padding: "4px 8px", minHeight: 28, color: "var(--danger)" }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Submission Buttons */}
          <div
            style={{
              marginTop: 12,
              paddingTop: 16,
              borderTop: "1px solid var(--line)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              type="submit"
              name="actionType"
              value="DRAFT"
              className="ghost"
              style={{ minHeight: 36, fontSize: 13 }}
            >
              Save as Draft
            </button>

            <button
              type="submit"
              name="actionType"
              value="SUBMIT_APPROVAL"
              style={{
                minHeight: 36,
                fontSize: 13,
                fontWeight: 600,
                background: "var(--surface)",
                color: "var(--foreground)",
                border: "1px solid var(--line-strong)",
              }}
            >
              Submit for Manager Approval
            </button>

            {["ADMIN", "MANAGER", "AUTHORITY"].includes(userRole) && (
              <button
                type="submit"
                name="actionType"
                value="DIRECT_DISTRIBUTE"
                style={{
                  minHeight: 36,
                  fontSize: 13,
                  fontWeight: 600,
                  background: "var(--accent)",
                  color: "white",
                }}
              >
                Distribute Directly & Deduct Stock
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component: Modal Add Recipient
// ---------------------------------------------------------------------------
function AddRecipientModal({
  eventId,
  eventName,
  items,
  employees,
  userRole,
  onClose,
}: {
  eventId: string;
  eventName: string;
  items: AvailableItem[];
  employees: AvailableEmployee[];
  userRole: string;
  onClose: () => void;
}) {
  const [empMode, setEmpMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || "");
  const [qty, setQty] = useState(1);
  const [recipientType, setRecipientType] = useState("WINNER");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(3px)",
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--surface)",
          boxShadow: "var(--shadow-lg)",
          borderRadius: "var(--radius)",
          padding: 0,
          margin: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Add Recipient to {eventName}</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
              Associate employee and allocate recognition goodie
            </p>
          </div>
          <button className="ghost" onClick={onClose} style={{ minHeight: 28, minWidth: 28, padding: 0 }}>
            ✕
          </button>
        </div>

        <form action={upsertEventRecipientAndDistribute} style={{ padding: 20 }}>
          <input type="hidden" name="eventId" value={eventId} />

          <div style={{ display: "grid", gap: 14 }}>
            {/* Identity mode toggle */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className={empMode === "EXISTING" ? "" : "ghost"}
                onClick={() => setEmpMode("EXISTING")}
                style={{ flex: 1, minHeight: 32, fontSize: 12 }}
              >
                Existing Employee
              </button>
              <button
                type="button"
                className={empMode === "NEW" ? "" : "ghost"}
                onClick={() => setEmpMode("NEW")}
                style={{ flex: 1, minHeight: 32, fontSize: 12 }}
              >
                Enroll New Employee
              </button>
            </div>

            {empMode === "EXISTING" ? (
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                  Select Employee *
                </label>
                <select
                  name="empId"
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  required
                  style={{ width: "100%", height: 36, fontSize: 13 }}
                >
                  <option value="">Choose employee...</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.empId}>
                      {e.empId} — {e.name} ({e.baseLocation || "HQ"})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                    Emp ID *
                  </label>
                  <input
                    type="text"
                    name="empId"
                    required
                    placeholder="e.g. EMP-101"
                    style={{ width: "100%", height: 36, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Jane Smith"
                    style={{ width: "100%", height: 36, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                    Location
                  </label>
                  <input
                    type="text"
                    name="baseLocation"
                    placeholder="HQ"
                    style={{ width: "100%", height: 36, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                    Department
                  </label>
                  <input
                    type="text"
                    name="department"
                    placeholder="Design"
                    style={{ width: "100%", height: 36, fontSize: 13 }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                  Recognition Role
                </label>
                <select
                  name="recipientType"
                  value={recipientType}
                  onChange={(e) => setRecipientType(e.target.value)}
                  style={{ width: "100%", height: 36, fontSize: 13 }}
                >
                  <option value="WINNER">Winner</option>
                  <option value="RUNNER_UP">Runner-up</option>
                  <option value="PARTICIPANT">Participant</option>
                  <option value="SPECIAL_RECOGNITION">Special Recognition</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                  Quantity
                </label>
                <input
                  type="number"
                  name="quantity"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)}
                  style={{ width: "100%", height: 36, fontSize: 13 }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                Awarded Goodie *
              </label>
              <select
                name="itemId"
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                required
                style={{ width: "100%", height: 36, fontSize: 13 }}
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.sku}) — {it.quantity} {it.unit} in stock
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                Remarks / Notes
              </label>
              <input
                type="text"
                name="notes"
                placeholder="Optional recognition details"
                style={{ width: "100%", height: 36, fontSize: 13 }}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid var(--line)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            <button type="button" className="ghost" onClick={onClose} style={{ minHeight: 34, fontSize: 13 }}>
              Cancel
            </button>
            <button
              type="submit"
              name="actionType"
              value="SUBMIT_APPROVAL"
              className="ghost"
              style={{ minHeight: 34, fontSize: 13 }}
            >
              Submit for Approval
            </button>
            {["ADMIN", "MANAGER", "AUTHORITY"].includes(userRole) && (
              <button
                type="submit"
                name="actionType"
                value="DIRECT_DISTRIBUTE"
                style={{ minHeight: 34, fontSize: 13, fontWeight: 600 }}
              >
                Distribute Directly
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component: Bulk Spreadsheet Import View (Objective C)
// ---------------------------------------------------------------------------
function BulkRecipientsImportView({
  eventId,
  userRole,
  onComplete,
}: {
  eventId: string;
  userRole: string;
  onComplete: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg("Please select an Excel .xlsx workbook first.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    setPreviewResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await previewEventRecipientsFile(formData);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setPreviewResult(res);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to parse workbook.");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async (actionType: "DIRECT_DISTRIBUTE" | "SUBMIT_APPROVAL") => {
    if (!previewResult || !previewResult.rows) return;
    setImporting(true);
    setErrorMsg("");

    try {
      const res = await executeEventRecipientsBulkImport(eventId, previewResult.rows, actionType);
      if (res.success) {
        setSuccessMsg(
          `Successfully processed bulk recipients! ${res.createdEmployeesCount} new employees created, ${res.updatedEmployeesCount} updated, ${res.postedCount} direct distributions posted, and ${res.pendingCount} submitted for approval.`
        );
        setPreviewResult(null);
        setFile(null);
        setTimeout(() => {
          onComplete();
        }, 1800);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to commit bulk import.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Upload & Template Card */}
      <div className="card" style={{ margin: 0, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Spreadsheet Recipient & Winner Import</h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)", maxWidth: 640 }}>
              Add multiple winners and participants in bulk. The system verifies employee identities, detects duplicates, checks inventory levels, and stages records safely.
            </p>
          </div>

          <a href="/api/events/template" download>
            <button
              type="button"
              className="ghost"
              style={{ fontSize: 12.5, minHeight: 32, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Download size={14} /> Download Excel Template
            </button>
          </a>
        </div>

        <form onSubmit={handlePreview} style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setPreviewResult(null);
                setErrorMsg("");
              }}
              style={{ fontSize: 13 }}
            />

            <button
              type="submit"
              disabled={!file || loading}
              style={{
                fontSize: 13,
                minHeight: 34,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="spin" /> Validating Spreadsheet...
                </>
              ) : (
                <>
                  <Upload size={14} /> Upload & Preview
                </>
              )}
            </button>
          </div>
        </form>

        {errorMsg && (
          <div className="err" style={{ marginTop: 14 }}>
            <AlertTriangle size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="notice" style={{ marginTop: 14 }}>
            <CheckCircle2 size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
            {successMsg}
          </div>
        )}
      </div>

      {/* Spreadsheet Preview & Validation View */}
      {previewResult && (
        <div className="card" style={{ margin: 0, padding: 0 }}>
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <strong style={{ fontSize: 14 }}>Spreadsheet Audit & Pre-Commit Preview</strong>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                {previewResult.validRows} valid row(s) ready • {previewResult.errors?.length || 0} error(s) flagged
                {previewResult.duplicateEmpIds?.length > 0 && ` • ${previewResult.duplicateEmpIds.length} duplicate ID(s)`}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => handleCommit("SUBMIT_APPROVAL")}
                disabled={importing || previewResult.validRows === 0}
                className="ghost"
                style={{ fontSize: 12.5, minHeight: 32 }}
              >
                Submit Valid Rows for Approval
              </button>

              {["ADMIN", "MANAGER", "AUTHORITY"].includes(userRole) && (
                <button
                  type="button"
                  onClick={() => handleCommit("DIRECT_DISTRIBUTE")}
                  disabled={importing || previewResult.validRows === 0}
                  style={{ fontSize: 12.5, minHeight: 32, fontWeight: 600 }}
                >
                  Direct Distribute & Post Deductions
                </button>
              )}
            </div>
          </div>

          <div className="table-container">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-subtle)", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 12 }}>Row</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Employee ID</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Name</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Role</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Goodie Reference</th>
                  <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 12 }}>Qty</th>
                  <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 12 }}>Available</th>
                  <th style={{ padding: "10px 18px", textAlign: "left", fontSize: 12 }}>Validation Status</th>
                </tr>
              </thead>
              <tbody>
                {previewResult.rows?.map((r: any) => (
                  <tr
                    key={r.rowNumber}
                    style={{
                      borderBottom: "1px solid var(--line)",
                      background: r.rowError ? "rgba(239, 68, 68, 0.04)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "10px 14px", textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
                      #{r.rowNumber}
                    </td>

                    <td style={{ padding: "10px 14px" }}>
                      <code style={{ fontWeight: 700 }}>{r.empId}</code>
                      {r.isExistingEmployee ? (
                        <span style={{ fontSize: 10.5, color: "var(--accent)", marginLeft: 6 }}>[Existing]</span>
                      ) : (
                        <span style={{ fontSize: 10.5, color: "#16a34a", marginLeft: 6 }}>[New Staff]</span>
                      )}
                    </td>

                    <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 550 }}>{r.name}</td>

                    <td style={{ padding: "10px 14px", fontSize: 12 }}>
                      <span className="badge PENDING" style={{ fontSize: 10.5 }}>
                        {r.recipientType}
                      </span>
                    </td>

                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.itemName}</div>
                      <code style={{ fontSize: 11 }}>{r.itemSku}</code>
                    </td>

                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700 }}>
                      {r.quantity}
                    </td>

                    <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 12 }}>
                      <span style={{ color: r.hasSufficientStock ? "var(--foreground)" : "var(--danger)", fontWeight: 600 }}>
                        {r.availableStock}
                      </span>
                    </td>

                    <td style={{ padding: "10px 18px" }}>
                      {r.rowError ? (
                        <span style={{ color: "var(--danger)", fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <AlertTriangle size={12} /> {r.rowError}
                        </span>
                      ) : !r.hasSufficientStock ? (
                        <span style={{ color: "#d97706", fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <AlertTriangle size={12} /> Stock deficit ({r.quantity} needed vs {r.availableStock} on hand)
                        </span>
                      ) : (
                        <span style={{ color: "#16a34a", fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <CheckCircle2 size={12} /> Ready to Commit
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
