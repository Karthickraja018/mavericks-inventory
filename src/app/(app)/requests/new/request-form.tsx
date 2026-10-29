"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Upload,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  UserPlus,
  Calendar,
  Plus,
  Trash2,
  Layers,
  Sparkles,
  Search,
  Filter,
  Package,
  Award,
  ChevronRight,
  Info,
} from "lucide-react";
import { createRequest } from "@/app/actions";
import {
  previewRequestSpreadsheet,
  createRequestFromExcelAction,
  ExtractedRecipientRow,
  ItemAggregation,
} from "../actions";

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

interface EventOption {
  id: string;
  name: string;
  category: string;
  date: string;
  status: string;
}

interface RequestLineState {
  itemId: string;
  quantity: number;
}

export function RequestForm({
  items,
  events,
  initialEventId,
}: {
  items: ItemOption[];
  events: EventOption[];
  initialEventId?: string;
}) {
  const router = useRouter();

  // Mode: "EXCEL" or "MANUAL"
  const [activeTab, setActiveTab] = useState<"EXCEL" | "MANUAL">("EXCEL");

  // Common Event Selection State
  const [eventMode, setEventMode] = useState<"EXISTING" | "NEW" | "AUTO" | "NONE">(
    initialEventId ? "EXISTING" : "AUTO"
  );
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId || (events[0]?.id || ""));
  const [newEventName, setNewEventName] = useState("");
  const [newEventCategory, setNewEventCategory] = useState("Goodies Distribution");

  // Excel Upload State
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [submittingExcel, setSubmittingExcel] = useState(false);
  const [previewData, setPreviewData] = useState<{
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateEmpIds: string[];
    rows: ExtractedRecipientRow[];
    itemSummaries: ItemAggregation[];
    newEmployeesCount: number;
    existingEmployeesCount: number;
    detectedEventName?: string;
    matchedEventId?: string;
    matchedEventName?: string;
  } | null>(null);
  const [excelError, setExcelError] = useState("");
  const [excelSuccess, setExcelSuccess] = useState("");
  const [excelPurpose, setExcelPurpose] = useState("");
  const [previewFilter, setPreviewFilter] = useState<"ALL" | "NEW_EMP" | "ERRORS" | "LOW_STOCK">("ALL");
  const [previewSearch, setPreviewSearch] = useState("");

  // Manual Form State
  const [manualPurpose, setManualPurpose] = useState("");
  const [lines, setLines] = useState<RequestLineState[]>([{ itemId: "", quantity: 1 }]);

  const itemMap = useMemo(() => new Map<string, ItemOption>(items.map((i) => [i.id, i])), [items]);

  // Handle Excel Preview / Extraction
  const handleExtractExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setExcelError("Please select an Excel .xlsx workbook first.");
      return;
    }

    setExtracting(true);
    setExcelError("");
    setExcelSuccess("");
    setPreviewData(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await previewRequestSpreadsheet(formData);
      if (res.error) {
        setExcelError(res.error);
      } else {
        setPreviewData(res as any);
        if (res.detectedEventName) {
          if (res.matchedEventId) {
            setSelectedEventId(res.matchedEventId);
            setEventMode("EXISTING");
          } else {
            setNewEventName(res.detectedEventName);
            setEventMode("NEW");
          }
        }
        const evLabel = res.detectedEventName || (events.find((ev) => ev.id === selectedEventId)?.name ?? "Company Event");
        setExcelPurpose(
          `Goodies requisition for ${evLabel} (${res.validRows} employee recipients)`
        );
      }
    } catch (err: any) {
      setExcelError(err.message || "Failed to extract Excel data.");
    } finally {
      setExtracting(false);
    }
  };

  // Handle Commit of Excel Request
  const handleCommitExcelRequest = async (intent: "draft" | "submit") => {
    if (!previewData || !previewData.rows.length) return;
    setSubmittingExcel(true);
    setExcelError("");

    try {
      // Determine final eventId vs newEventName
      let finalEventId: string | null = null;
      let finalNewEventName: string | null = null;

      if (eventMode === "EXISTING" && selectedEventId) {
        finalEventId = selectedEventId;
      } else if (eventMode === "NEW" && newEventName.trim()) {
        finalNewEventName = newEventName.trim();
      } else if (eventMode === "AUTO") {
        if (previewData.matchedEventId) {
          finalEventId = previewData.matchedEventId;
        } else if (previewData.detectedEventName) {
          finalNewEventName = previewData.detectedEventName;
        } else if (selectedEventId) {
          finalEventId = selectedEventId;
        }
      }

      const validRowsForPayload = previewData.rows
        .filter((r) => !r.rowError && r.itemId)
        .map((r) => ({
          empId: r.empId,
          name: r.name,
          recipientType: r.recipientType,
          itemId: r.itemId!,
          quantity: r.quantity,
          baseLocation: r.baseLocation,
          department: r.department,
          email: r.email,
          notes: r.notes,
        }));

      if (!validRowsForPayload.length) {
        throw new Error("No valid rows available to submit. Please check row errors.");
      }

      const res = await createRequestFromExcelAction({
        eventId: finalEventId,
        newEventName: finalNewEventName,
        eventCategory: newEventCategory,
        purpose: excelPurpose,
        intent,
        rows: validRowsForPayload,
      });

      if (res.success) {
        setExcelSuccess(
          `Request REQ-${String(res.requestNumber).padStart(5, "0")} successfully created! ` +
            `${res.newEmployeesCount > 0 ? `${res.newEmployeesCount} new employees created. ` : ""}` +
            `${res.isEventCreated ? `Event "${res.finalEventName}" created. ` : ""}` +
            "Redirecting..."
        );
        setTimeout(() => {
          router.push(`/requests/${res.requestId}`);
        }, 1200);
      }
    } catch (err: any) {
      setExcelError(err.message || "Failed to create request from Excel.");
      setSubmittingExcel(false);
    }
  };

  // Filtered preview rows
  const filteredPreviewRows = useMemo(() => {
    if (!previewData) return [];
    let list = previewData.rows;

    if (previewFilter === "NEW_EMP") {
      list = list.filter((r) => !r.isExistingEmployee && !r.rowError);
    } else if (previewFilter === "ERRORS") {
      list = list.filter((r) => !!r.rowError);
    } else if (previewFilter === "LOW_STOCK") {
      list = list.filter((r) => !r.hasSufficientStock && !r.rowError);
    }

    if (previewSearch.trim()) {
      const q = previewSearch.toLowerCase();
      list = list.filter(
        (r) =>
          r.empId.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.itemName.toLowerCase().includes(q) ||
          (r.department && r.department.toLowerCase().includes(q))
      );
    }

    return list;
  }, [previewData, previewFilter, previewSearch]);

  // Total required units in Excel extraction
  const totalExcelRequestedUnits = useMemo(() => {
    if (!previewData) return 0;
    return previewData.rows
      .filter((r) => !r.rowError)
      .reduce((sum, r) => sum + r.quantity, 0);
  }, [previewData]);

  // Check if any item has stock deficit
  const hasDeficit = useMemo(() => {
    if (!previewData) return false;
    return previewData.itemSummaries.some((i) => !i.isSufficient);
  }, [previewData]);

  // Manual Line change handlers
  const handleAddLine = () => {
    if (lines.length >= 10) return;
    setLines([...lines, { itemId: "", quantity: 1 }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: keyof RequestLineState, val: string | number) => {
    const updated = [...lines];
    if (field === "itemId") {
      updated[idx].itemId = String(val);
    } else {
      updated[idx].quantity = Math.max(1, Number(val) || 1);
    }
    setLines(updated);
  };

  const selectedItemIds = lines.map((l) => l.itemId).filter(Boolean);
  const hasDuplicates = new Set(selectedItemIds).size !== selectedItemIds.length;
  const isManualValid = lines.some((l) => l.itemId && l.quantity > 0) && !hasDuplicates;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Tab Switcher */}
      <div
        style={{
          display: "flex",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          padding: 4,
          gap: 6,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("EXCEL")}
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 40,
            fontSize: 13.5,
            fontWeight: 650,
            borderRadius: 7,
            background: activeTab === "EXCEL" ? "var(--accent)" : "transparent",
            color: activeTab === "EXCEL" ? "#fff" : "var(--foreground-muted)",
            border: "none",
            boxShadow: activeTab === "EXCEL" ? "var(--shadow-sm)" : "none",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <FileSpreadsheet size={16} />
          <span>Upload Excel Sheet</span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 12,
              background: activeTab === "EXCEL" ? "rgba(255,255,255,0.25)" : "var(--accent-soft)",
              color: activeTab === "EXCEL" ? "#fff" : "var(--accent-dark)",
            }}
          >
            Recommended · Reduces Workload
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("MANUAL")}
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 40,
            fontSize: 13.5,
            fontWeight: 650,
            borderRadius: 7,
            background: activeTab === "MANUAL" ? "var(--accent)" : "transparent",
            color: activeTab === "MANUAL" ? "#fff" : "var(--foreground-muted)",
            border: "none",
            boxShadow: activeTab === "MANUAL" ? "var(--shadow-sm)" : "none",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <Plus size={16} />
          <span>Manual Item Selection</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: EXCEL SMART REQUEST                                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "EXCEL" && (
        <div style={{ display: "grid", gap: 20 }}>
          {/* Card 1: Event Association Option */}
          <div className="card" style={{ margin: 0, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Calendar size={17} style={{ color: "var(--accent)" }} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>1. Event Association</h3>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted)" }}>
              Choose an event to link with this requisition. If your Excel file contains an event name,
              the system can auto-detect it and create the event if it doesn't already exist.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 14 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  border: eventMode === "AUTO" ? "2px solid var(--accent)" : "1px solid var(--line)",
                  borderRadius: 8,
                  background: eventMode === "AUTO" ? "var(--surface-subtle)" : "var(--surface)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <input
                  type="radio"
                  name="eventMode"
                  checked={eventMode === "AUTO"}
                  onChange={() => setEventMode("AUTO")}
                />
                <span>Auto-Detect from File</span>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  border: eventMode === "EXISTING" ? "2px solid var(--accent)" : "1px solid var(--line)",
                  borderRadius: 8,
                  background: eventMode === "EXISTING" ? "var(--surface-subtle)" : "var(--surface)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <input
                  type="radio"
                  name="eventMode"
                  checked={eventMode === "EXISTING"}
                  onChange={() => setEventMode("EXISTING")}
                />
                <span>Choose Existing Event</span>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  border: eventMode === "NEW" ? "2px solid var(--accent)" : "1px solid var(--line)",
                  borderRadius: 8,
                  background: eventMode === "NEW" ? "var(--surface-subtle)" : "var(--surface)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <input
                  type="radio"
                  name="eventMode"
                  checked={eventMode === "NEW"}
                  onChange={() => setEventMode("NEW")}
                />
                <span>Create New Event</span>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  border: eventMode === "NONE" ? "2px solid var(--accent)" : "1px solid var(--line)",
                  borderRadius: 8,
                  background: eventMode === "NONE" ? "var(--surface-subtle)" : "var(--surface)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <input
                  type="radio"
                  name="eventMode"
                  checked={eventMode === "NONE"}
                  onChange={() => setEventMode("NONE")}
                />
                <span>No Event (General)</span>
              </label>
            </div>

            {/* Event mode specific inputs */}
            {eventMode === "EXISTING" && (
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Select Existing Active Event:
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  style={{ width: "100%", fontSize: 13, minHeight: 38 }}
                >
                  <option value="">-- Choose Event --</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} ({ev.category} · {ev.date})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {eventMode === "NEW" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 12, marginTop: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                    New Event Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Annual Tech Hackathon 2026, Sports Gala, Town Hall..."
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    style={{ width: "100%", fontSize: 13, minHeight: 38 }}
                  />
                  <small style={{ color: "var(--muted)", display: "block", marginTop: 4 }}>
                    If this event doesn't exist, it will be automatically created and linked to this request.
                  </small>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                    Category
                  </label>
                  <select
                    value={newEventCategory}
                    onChange={(e) => setNewEventCategory(e.target.value)}
                    style={{ width: "100%", fontSize: 13, minHeight: 38 }}
                  >
                    <option value="Goodies Distribution">Goodies Distribution</option>
                    <option value="Hackathon">Hackathon</option>
                    <option value="Cultural">Cultural</option>
                    <option value="Sports">Sports</option>
                    <option value="Town Hall">Town Hall</option>
                    <option value="Milestone">Milestone</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>
            )}

            {eventMode === "AUTO" && (
              <div
                style={{
                  marginTop: 10,
                  padding: "10px 14px",
                  background: "var(--surface-subtle)",
                  borderRadius: 6,
                  fontSize: 12.5,
                  color: "var(--foreground-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Sparkles size={15} style={{ color: "var(--accent)" }} />
                <span>
                  The system will inspect your workbook headers, rows, and sheets for an event name.
                  If an event already matches, it will be linked; otherwise, a new event will be created automatically.
                </span>
              </div>
            )}
          </div>

          {/* Card 2: Upload Dropzone & Template Download */}
          <div className="card" style={{ margin: 0, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>2. Upload Excel Workbook</h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)", maxWidth: 600 }}>
                  Upload an Excel workbook (.xlsx) containing employee IDs, names, goodie item SKUs or names, and quantities.
                </p>
              </div>

              <a href="/api/requests/template" download>
                <button
                  type="button"
                  className="ghost"
                  style={{ fontSize: 12.5, minHeight: 34, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Download size={14} /> Download Excel Template
                </button>
              </a>
            </div>

            <form onSubmit={handleExtractExcel} style={{ marginTop: 20 }}>
              <div
                style={{
                  border: "2px dashed var(--line-strong)",
                  borderRadius: 10,
                  padding: "24px 20px",
                  textAlign: "center",
                  background: "var(--surface-subtle)",
                  transition: "border 0.2s ease",
                }}
              >
                <FileSpreadsheet size={36} style={{ color: "var(--accent)", margin: "0 auto 10px" }} />
                <h4 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 650 }}>
                  {file ? file.name : "Select or Drop your Excel Workbook here"}
                </h4>
                <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--muted)" }}>
                  Supports .xlsx files with columns: <strong>Event Name</strong> (optional), <strong>Emp ID</strong>, <strong>Name</strong>, <strong>Role</strong>, <strong>Item SKU/Name</strong>, <strong>Quantity</strong>
                </p>

                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <input
                    type="file"
                    accept=".xlsx"
                    id="excelFileInput"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null);
                      setPreviewData(null);
                      setExcelError("");
                      setExcelSuccess("");
                    }}
                    style={{ fontSize: 13 }}
                  />

                  <button
                    type="submit"
                    disabled={!file || extracting}
                    style={{
                      fontSize: 13,
                      minHeight: 36,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {extracting ? (
                      <>
                        <RefreshCw size={14} className="spin" /> Extracting & Validating...
                      </>
                    ) : (
                      <>
                        <Upload size={14} /> Extract Data & Verify
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {excelError && (
              <div className="err" style={{ marginTop: 14 }}>
                <AlertTriangle size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                {excelError}
              </div>
            )}

            {excelSuccess && (
              <div className="notice" style={{ marginTop: 14 }}>
                <CheckCircle2 size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                {excelSuccess}
              </div>
            )}
          </div>

          {/* Card 3: Extraction Summary & Verification Dashboard */}
          {previewData && (
            <div style={{ display: "grid", gap: 20 }}>
              {/* Extraction Metrics Bar */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: 12,
                }}
              >
                {/* Event Card */}
                <div className="card" style={{ margin: 0, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Calendar size={16} style={{ color: "var(--accent)" }} />
                    <span style={{ fontSize: 12, fontWeight: 650, color: "var(--foreground-muted)" }}>
                      Event Target
                    </span>
                  </div>
                  <strong style={{ fontSize: 15, color: "var(--ink)", display: "block" }}>
                    {previewData.matchedEventName ||
                      previewData.detectedEventName ||
                      (eventMode === "NEW" && newEventName ? newEventName : "Company Event")}
                  </strong>
                  <small style={{ color: "var(--muted)", display: "block", marginTop: 2 }}>
                    {previewData.matchedEventId
                      ? "✓ Existing Event matched"
                      : previewData.detectedEventName
                      ? "✨ Will be created automatically"
                      : "General Requisition"}
                  </small>
                </div>

                {/* Employees Card */}
                <div className="card" style={{ margin: 0, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <UserCheck size={16} style={{ color: "var(--success)" }} />
                    <span style={{ fontSize: 12, fontWeight: 650, color: "var(--foreground-muted)" }}>
                      Recipients Extracted
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <strong style={{ fontSize: 20, color: "var(--ink)" }}>{previewData.validRows}</strong>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>valid recipients</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 11.5 }}>
                    <span style={{ color: "var(--muted)" }}>{previewData.existingEmployeesCount} existing</span>
                    <span>•</span>
                    <span style={{ color: "var(--accent)", fontWeight: 650 }}>
                      ✨ {previewData.newEmployeesCount} new staff to auto-create
                    </span>
                  </div>
                </div>

                {/* Items & Demand Card */}
                <div className="card" style={{ margin: 0, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Package size={16} style={{ color: "var(--accent)" }} />
                    <span style={{ fontSize: 12, fontWeight: 650, color: "var(--foreground-muted)" }}>
                      Goodies & Stock
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <strong style={{ fontSize: 20, color: "var(--ink)" }}>
                      {totalExcelRequestedUnits}
                    </strong>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      units ({previewData.itemSummaries.length} items)
                    </span>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    {hasDeficit ? (
                      <span className="badge REJECTED" style={{ fontSize: 11 }}>
                        ⚠ Deficit on some items
                      </span>
                    ) : (
                      <span className="badge APPROVED" style={{ fontSize: 11 }}>
                        ✓ 100% Stock Available
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Item Demand Breakdown */}
              <div className="card" style={{ margin: 0, padding: 18 }}>
                <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 650 }}>
                  Aggregated Goodies Demanded in this Requisition:
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                  {previewData.itemSummaries.map((item) => (
                    <div
                      key={item.itemId}
                      style={{
                        padding: "10px 14px",
                        background: item.isSufficient ? "var(--surface-subtle)" : "#fff1f2",
                        border: item.isSufficient ? "1px solid var(--line)" : "1px solid #fecdd3",
                        borderRadius: 6,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 13, display: "block" }}>{item.name}</strong>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}><code>{item.sku}</code></span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                          {item.totalRequested} {item.unit}
                        </div>
                        <small
                          style={{
                            fontSize: 11,
                            color: item.isSufficient ? "var(--success)" : "var(--danger)",
                            fontWeight: 600,
                          }}
                        >
                          Stock: {item.availableStock}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recipient Rows Table with Filters */}
              <div className="card scroll" style={{ margin: 0, padding: 0 }}>
                <div
                  style={{
                    padding: "12px 18px",
                    borderBottom: "1px solid var(--line)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h4 style={{ margin: 0, fontSize: 14 }}>
                      Extracted Recipient List ({filteredPreviewRows.length} of {previewData.rows.length})
                    </h4>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ position: "relative" }}>
                      <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                      <input
                        type="text"
                        placeholder="Search employee, item..."
                        value={previewSearch}
                        onChange={(e) => setPreviewSearch(e.target.value)}
                        style={{ height: 32, fontSize: 12, paddingLeft: 30, width: 200 }}
                      />
                    </div>

                    <select
                      value={previewFilter}
                      onChange={(e) => setPreviewFilter(e.target.value as any)}
                      style={{ height: 32, fontSize: 12 }}
                    >
                      <option value="ALL">All Rows ({previewData.rows.length})</option>
                      <option value="NEW_EMP">✨ New Employees ({previewData.newEmployeesCount})</option>
                      <option value="LOW_STOCK">⚠ Stock Deficits</option>
                      <option value="ERRORS">❌ Errors Only ({previewData.invalidRows})</option>
                    </select>
                  </div>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>#</th>
                      <th style={{ width: 140 }}>Emp ID</th>
                      <th>Employee Name</th>
                      <th style={{ width: 130 }}>Recognition Role</th>
                      <th>Item Allocated</th>
                      <th className="numeric" style={{ width: 80 }}>Qty</th>
                      <th style={{ width: 140 }}>Stock Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPreviewRows.map((r, idx) => (
                      <tr key={idx} style={{ background: r.rowError ? "#fff1f2" : undefined }}>
                        <td style={{ fontSize: 11.5, color: "var(--muted)" }}>{r.rowNumber}</td>
                        <td>
                          <code>{r.empId}</code>
                          {!r.isExistingEmployee && !r.rowError && (
                            <span
                              style={{
                                display: "block",
                                fontSize: 10,
                                color: "var(--accent)",
                                fontWeight: 700,
                                marginTop: 2,
                              }}
                            >
                              ✨ NEW STAFF
                            </span>
                          )}
                        </td>
                        <td>
                          <strong style={{ fontSize: 13 }}>{r.name}</strong>
                          <small style={{ color: "var(--muted)", display: "block" }}>
                            {r.baseLocation} {r.department ? `· ${r.department}` : ""}
                          </small>
                        </td>
                        <td>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 7px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 650,
                              background:
                                r.recipientType === "WINNER"
                                  ? "rgba(245, 158, 11, 0.15)"
                                  : r.recipientType === "RUNNER_UP"
                                  ? "rgba(59, 130, 246, 0.15)"
                                  : "var(--surface-subtle)",
                              color:
                                r.recipientType === "WINNER"
                                  ? "#d97706"
                                  : r.recipientType === "RUNNER_UP"
                                  ? "#2563eb"
                                  : "var(--foreground-muted)",
                            }}
                          >
                            {r.recipientType.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td>
                          {r.rowError ? (
                            <span style={{ color: "var(--danger)", fontSize: 12, fontWeight: 600 }}>
                              {r.rowError}
                            </span>
                          ) : (
                            <div>
                              <strong style={{ fontSize: 12.5 }}>{r.itemName}</strong>
                              <small style={{ color: "var(--muted)", display: "block" }}>
                                <code>{r.itemSku}</code>
                              </small>
                            </div>
                          )}
                        </td>
                        <td className="numeric" style={{ fontWeight: 700 }}>
                          {r.quantity}
                        </td>
                        <td>
                          {r.rowError ? (
                            <span className="badge REJECTED" style={{ fontSize: 10.5 }}>
                              Invalid
                            </span>
                          ) : r.hasSufficientStock ? (
                            <span className="badge APPROVED" style={{ fontSize: 10.5 }}>
                              ✓ Available
                            </span>
                          ) : (
                            <span className="badge REJECTED" style={{ fontSize: 10.5 }}>
                              ⚠ Deficit
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {!filteredPreviewRows.length && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>
                          No recipient rows match the selected filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Justification & Submission Card */}
              <div className="card" style={{ margin: 0, padding: 20 }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700 }}>
                  3. Purpose & Submission
                </h3>

                <label htmlFor="excelPurpose" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Business Purpose / Justification *
                </label>
                <textarea
                  id="excelPurpose"
                  rows={2}
                  value={excelPurpose}
                  onChange={(e) => setExcelPurpose(e.target.value)}
                  placeholder="Justification for approving this goodies requisition..."
                  style={{ width: "100%", fontSize: 13, resize: "vertical" }}
                  required
                />
                <small style={{ color: "var(--muted)", display: "block", marginTop: 4 }}>
                  This requisition will create the request, auto-provision any new event and employees, and link recipient distribution records.
                </small>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: "1px solid var(--line)",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 13, color: "var(--foreground-muted)" }}>
                    Ready to raise request for <strong>{previewData.validRows} recipients</strong> ({totalExcelRequestedUnits} total units)
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setPreviewData(null);
                        setFile(null);
                      }}
                      disabled={submittingExcel}
                      style={{ minHeight: 36 }}
                    >
                      Clear & Start Over
                    </button>

                    <button
                      type="button"
                      className="ghost"
                      onClick={() => handleCommitExcelRequest("draft")}
                      disabled={submittingExcel || !excelPurpose.trim() || previewData.validRows === 0}
                      style={{ minHeight: 36 }}
                    >
                      {submittingExcel ? "Processing..." : "Save as Draft"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCommitExcelRequest("submit")}
                      disabled={submittingExcel || !excelPurpose.trim() || previewData.validRows === 0}
                      style={{ minHeight: 36, display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      {submittingExcel ? (
                        <>
                          <RefreshCw size={14} className="spin" /> Raising Request...
                        </>
                      ) : (
                        <>Submit for Approval →</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: MANUAL LINE-BY-LINE REQUEST                            */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "MANUAL" && (
        <form action={createRequest} style={{ display: "grid", gap: 20 }}>
          {/* Event Picker for Manual Request */}
          <div className="card" style={{ margin: 0, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Calendar size={17} style={{ color: "var(--accent)" }} />
              <h3 style={{ margin: "0", fontSize: 15, fontWeight: 700 }}>1. Event Link (Optional)</h3>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted)" }}>
              Associate this manual requisition with an existing event or create a new event directly.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Choose Existing Event
                </label>
                <select
                  name="eventId"
                  value={selectedEventId}
                  onChange={(e) => {
                    setSelectedEventId(e.target.value);
                    if (e.target.value) setNewEventName("");
                  }}
                  style={{ width: "100%", fontSize: 13, minHeight: 38 }}
                >
                  <option value="">-- No Event / General Requisition --</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} ({ev.category} · {ev.date})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Or Create New Event
                </label>
                <input
                  type="text"
                  name="newEventName"
                  placeholder="New event name (if not in dropdown)..."
                  value={newEventName}
                  onChange={(e) => {
                    setNewEventName(e.target.value);
                    if (e.target.value) setSelectedEventId("");
                  }}
                  style={{ width: "100%", fontSize: 13, minHeight: 38 }}
                />
              </div>
            </div>
          </div>

          {/* Purpose Card */}
          <div className="card" style={{ margin: 0, padding: 20 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700 }}>2. Request Justification</h3>
            <label htmlFor="purpose" style={{ fontWeight: 600 }}>
              Purpose / Business Justification *
            </label>
            <textarea
              id="purpose"
              name="purpose"
              required
              rows={3}
              placeholder="State why these items are requested (e.g., Regional sales enablement event, New hire hardware provisioning, Customer visit gift packs)..."
              value={manualPurpose}
              onChange={(e) => setManualPurpose(e.target.value)}
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
                <h3 style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700 }}>3. Requested Items</h3>
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
                <AlertTriangle size={16} />
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
                    <input type="hidden" name={`item${idx}`} value={line.itemId} />
                    <input type="hidden" name={`qty${idx}`} value={line.itemId ? line.quantity : 0} />

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <label style={{ fontSize: 11.5, margin: 0 }}>Item {idx + 1} *</label>
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
          </div>

          {/* Summary & Submission */}
          <div className="card" style={{ margin: 0, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
              <div>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Manual Request Summary:</span>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>
                  {lines.filter((l) => l.itemId).length} distinct items ·{" "}
                  {lines.reduce((acc, l) => acc + (l.itemId ? l.quantity : 0), 0)} total units
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
                  disabled={!isManualValid || !manualPurpose.trim()}
                  style={{ minHeight: 36 }}
                >
                  Save as Draft
                </button>
                <button
                  type="submit"
                  name="intent"
                  value="submit"
                  disabled={!isManualValid || !manualPurpose.trim()}
                  style={{ minHeight: 36 }}
                >
                  Submit for Approval →
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
