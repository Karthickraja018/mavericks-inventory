"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Calendar, MapPin, Tag, ArrowRight, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

export type EventListItem = {
  id: string;
  name: string;
  category: string;
  dateStr: string;
  location: string | null;
  description: string | null;
  status: string;
  uniqueRecipients: number;
  totalUnitsDistributed: number;
  pendingRequestsCount: number;
  totalRequestsCount: number;
  approvalStatus: "PENDING" | "APPROVED" | "NEEDS_REVIEW" | "NONE";
};

export function EventsListView({ events }: { events: EventListItem[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const categories = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchSearch =
        !search ||
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        (e.location && e.location.toLowerCase().includes(search.toLowerCase())) ||
        (e.description && e.description.toLowerCase().includes(search.toLowerCase()));

      const matchStatus = statusFilter === "ALL" || e.status === statusFilter;
      const matchCategory = categoryFilter === "ALL" || e.category === categoryFilter;

      return matchSearch && matchStatus && matchCategory;
    });
  }, [events, search, statusFilter, categoryFilter]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Search and Filters Toolbar */}
      <div
        className="card"
        style={{
          margin: 0,
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ position: "relative", minWidth: 260, flex: 1 }}>
          <Search
            size={15}
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
            placeholder="Search events by name, location, or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              paddingLeft: 36,
              width: "100%",
              height: 36,
              fontSize: 13,
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ height: 36, fontSize: 13, minWidth: 130 }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Events</option>
            <option value="COMPLETED">Completed Events</option>
          </select>

          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ height: 36, fontSize: 13, minWidth: 140 }}
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          {(search || statusFilter !== "ALL" || categoryFilter !== "ALL") && (
            <button
              className="ghost"
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setCategoryFilter("ALL");
              }}
              style={{ height: 36, fontSize: 12, color: "var(--muted)" }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Events List Table */}
      <div className="card" style={{ margin: 0, padding: 0 }}>
        <div className="table-container">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-subtle)", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: "12px 18px", textAlign: "left", fontSize: 12, fontWeight: 650 }}>Event Name</th>
                <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, fontWeight: 650 }}>Date & Venue</th>
                <th style={{ padding: "12px 14px", textAlign: "center", fontSize: 12, fontWeight: 650 }}>Status</th>
                <th style={{ padding: "12px 14px", textAlign: "right", fontSize: 12, fontWeight: 650 }}>Unique Recipients</th>
                <th style={{ padding: "12px 14px", textAlign: "right", fontSize: 12, fontWeight: 650 }}>Units Distributed</th>
                <th style={{ padding: "12px 14px", textAlign: "center", fontSize: 12, fontWeight: 650 }}>Approval Status</th>
                <th style={{ padding: "12px 18px", textAlign: "right", fontSize: 12, fontWeight: 650 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((e) => (
                <tr
                  key={e.id}
                  style={{
                    borderBottom: "1px solid var(--line)",
                    transition: "background 0.15s ease",
                  }}
                  className="table-row-hover"
                >
                  <td style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <Link
                        href={`/events/${e.id}`}
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--foreground)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {e.name}
                      </Link>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--muted)" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <Tag size={11} /> {e.category}
                        </span>
                        {e.description && (
                          <span style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            • {e.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: "14px 14px", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 550 }}>
                        <Calendar size={13} style={{ color: "var(--muted)" }} />
                        {e.dateStr}
                      </span>
                      {e.location && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--muted)", fontSize: 11 }}>
                          <MapPin size={11} />
                          {e.location}
                        </span>
                      )}
                    </div>
                  </td>

                  <td style={{ padding: "14px 14px", textAlign: "center" }}>
                    <StatusBadge status={e.status} size="sm" />
                  </td>

                  <td style={{ padding: "14px 14px", textAlign: "right", fontWeight: 600, fontSize: 13 }}>
                    {e.uniqueRecipients}
                  </td>

                  <td style={{ padding: "14px 14px", textAlign: "right" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 12,
                        background: e.totalUnitsDistributed > 0 ? "rgba(34, 197, 94, 0.1)" : "var(--surface-subtle)",
                        color: e.totalUnitsDistributed > 0 ? "#16a34a" : "var(--muted)",
                        fontWeight: 700,
                        fontSize: 12.5,
                      }}
                    >
                      {e.totalUnitsDistributed} pcs
                    </span>
                  </td>

                  <td style={{ padding: "14px 14px", textAlign: "center" }}>
                    {e.approvalStatus === "PENDING" ? (
                      <span
                        className="badge PENDING"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}
                        title={`${e.pendingRequestsCount} request(s) awaiting approval`}
                      >
                        <Clock size={11} /> {e.pendingRequestsCount} Pending
                      </span>
                    ) : e.approvalStatus === "NEEDS_REVIEW" ? (
                      <span
                        className="badge REJECTED"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}
                      >
                        <AlertTriangle size={11} /> Review Needed
                      </span>
                    ) : e.approvalStatus === "APPROVED" ? (
                      <span
                        className="badge APPROVED"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}
                      >
                        <CheckCircle2 size={11} /> Approved
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 11 }}>None</span>
                    )}
                  </td>

                  <td style={{ padding: "14px 18px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <Link href={`/events/${e.id}`}>
                      <button
                        style={{
                          fontSize: 12,
                          padding: "4px 12px",
                          minHeight: 28,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        Open Event <ArrowRight size={12} />
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}

              {!filteredEvents.length && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted)" }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 550 }}>No events match your search or filter.</p>
                    <p style={{ margin: "4px 0 0", fontSize: 12 }}>
                      Create a new event or try resetting your search filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
