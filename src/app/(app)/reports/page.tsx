import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { StockIndicator } from "@/components/ui/stock-indicator";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FileSpreadsheet,
  Download,
  Boxes,
  AlertTriangle,
  History,
  Gift,
  Users,
  Scale,
  Calendar,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { tab?: string; from?: string; to?: string };
}) {
  await requireUser();
  const activeTab = searchParams.tab || "stock";

  // Fetch preview data for active report
  const [stockItems, lowStockItems, recentMovements, eventDistributions, employeeSummaries] =
    await Promise.all([
      activeTab === "stock"
        ? db.item.findMany({
            where: { active: true },
            orderBy: { name: "asc" },
            take: 50,
          })
        : [],
      activeTab === "low_stock"
        ? db.item.findMany({
            where: { active: true, quantity: { lte: 10 } },
            orderBy: { quantity: "asc" },
            take: 50,
          })
        : [],
      activeTab === "ledger"
        ? db.stockMovement.findMany({
            orderBy: { createdAt: "desc" },
            take: 50,
            include: { item: { select: { sku: true, name: true, unit: true } } },
          })
        : [],
      activeTab === "events"
        ? db.distributionRecord.findMany({
            where: { OR: [{ eventId: { not: null } }, { recipientType: { not: null } }] },
            orderBy: { distributionDate: "desc" },
            take: 50,
            include: {
              item: { select: { sku: true, name: true, unit: true } },
              employee: { select: { empId: true, name: true, baseLocation: true } },
              event: { select: { name: true, category: true } },
            },
          })
        : [],
      activeTab === "employees"
        ? db.employee.findMany({
            where: { active: true },
            take: 50,
            orderBy: { empId: "asc" },
            include: {
              distributions: {
                select: { quantity: true, itemId: true },
              },
            },
          })
        : [],
    ]);

  const REPORT_TABS = [
    { id: "stock", label: "Current Stock", icon: Boxes },
    { id: "low_stock", label: "Low & Zero Stock", icon: AlertTriangle },
    { id: "ledger", label: "Movement Ledger", icon: History },
    { id: "events", label: "Event Goodies", icon: Gift },
    { id: "employees", label: "Employee Collections", icon: Users },
    { id: "templates", label: "Spreadsheet Templates", icon: FileSpreadsheet },
  ];

  return (
    <>
      <PageHeader
        title="Reports & Export Center"
        description="Operational data exports, live preview tables, auditable ledger summaries, and official spreadsheet templates."
        breadcrumbs={[
          { label: "Workspace", href: "/" },
          { label: "Reports & Exports" },
        ]}
      />

      {/* Report Categories Tabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 8,
          marginBottom: 16,
          borderBottom: "1px solid var(--line)",
        }}
      >
        {REPORT_TABS.map((t) => {
          const isActive = activeTab === t.id;
          const Icon = t.icon;
          return (
            <Link
              key={t.id}
              href={`/reports?tab=${t.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: isActive ? 650 : 500,
                color: isActive ? "var(--accent-dark)" : "var(--ink-soft)",
                background: isActive ? "var(--accent-soft)" : "transparent",
                borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                whiteSpace: "nowrap",
                textDecoration: "none",
              }}
            >
              <Icon size={15} style={{ color: isActive ? "var(--accent)" : "var(--muted)" }} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>

      {/* REPORT 1: CURRENT STOCK MASTER */}
      {activeTab === "stock" && (
        <>
          <div
            className="card"
            style={{
              padding: "12px 16px",
              marginBottom: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <strong style={{ fontSize: 14 }}>Active Stock Valuation Report</strong>
              <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 12 }}>
                Live balances on hand across all active product variants.
              </p>
            </div>
            <a href="/reports/stock.csv" download>
              <button style={{ minHeight: 34, fontSize: 13 }}>
                <Download size={14} /> Download Stock CSV
              </button>
            </a>
          </div>

          <div className="card scroll" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Variant Name</th>
                  <th>Attributes</th>
                  <th>Category</th>
                  <th className="numeric">Balance On Hand</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stockItems.map((it) => (
                  <tr key={it.id}>
                    <td><code>{it.sku}</code></td>
                    <td><Link href={`/inventory/${it.id}`}><strong>{it.name}</strong></Link></td>
                    <td>
                      <small style={{ color: "var(--muted)" }}>
                        {[it.size, it.color, it.brand].filter(Boolean).join(" · ") || "Standard"}
                      </small>
                    </td>
                    <td>{it.category}</td>
                    <td className="numeric"><StockIndicator quantity={Number(it.quantity)} unit={it.unit} /></td>
                    <td><StatusBadge status="ACTIVE" size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* REPORT 2: LOW & ZERO STOCK ALERTS */}
      {activeTab === "low_stock" && (
        <>
          <div
            className="card"
            style={{
              padding: "12px 16px",
              marginBottom: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <strong style={{ fontSize: 14, color: "var(--warning-dark)" }}>
                Low & Out of Stock Replenishment Report ({lowStockItems.length})
              </strong>
              <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 12 }}>
                Identifies variants with critical inventory deficit (&le;10 units) requiring procurement.
              </p>
            </div>
            <a href="/reports/stock.csv" download>
              <button className="ghost" style={{ minHeight: 34, fontSize: 13 }}>
                <Download size={14} /> Export Master Stock
              </button>
            </a>
          </div>

          <div className="card scroll" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th className="numeric">Current Available</th>
                  <th>Deficit Level</th>
                  <th style={{ textAlign: "right" }}>Procurement Action</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map((it) => {
                  const q = Number(it.quantity);
                  return (
                    <tr key={it.id}>
                      <td><code>{it.sku}</code></td>
                      <td><Link href={`/inventory/${it.id}`}><strong>{it.name}</strong></Link></td>
                      <td>{it.category}</td>
                      <td className="numeric"><StockIndicator quantity={q} unit={it.unit} /></td>
                      <td>
                        {q <= 0 ? (
                          <span className="badge REJECTED" style={{ fontSize: 11 }}>Critical (0 Units)</span>
                        ) : (
                          <span className="badge PENDING" style={{ fontSize: 11 }}>Reorder Required (&le;10)</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link href="/procurement">
                          <button className="ghost" style={{ fontSize: 11, padding: "2px 8px", minHeight: 26 }}>
                            Procure Stock →
                          </button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!lowStockItems.length && (
              <EmptyState
                icon={Boxes}
                title="Healthy inventory levels"
                description="There are currently no items with low or zero stock on hand."
              />
            )}
          </div>
        </>
      )}

      {/* REPORT 3: STOCK MOVEMENT LEDGER */}
      {activeTab === "ledger" && (
        <>
          <div
            className="card"
            style={{
              padding: "12px 16px",
              marginBottom: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <strong style={{ fontSize: 14 }}>Immutable Stock Movement Ledger</strong>
              <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 12 }}>
                Sequential record of all inventory issues, receipts, and reconciliations.
              </p>
            </div>
            <a href="/reports/ledger.csv" download>
              <button style={{ minHeight: 34, fontSize: 13 }}>
                <Download size={14} /> Download Ledger CSV
              </button>
            </a>
          </div>

          <div className="card scroll" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Item (SKU · Name)</th>
                  <th>Movement Type</th>
                  <th className="numeric">Delta</th>
                  <th className="numeric">Balance After</th>
                  <th>Reason / Reference</th>
                </tr>
              </thead>
              <tbody>
                {recentMovements.map((m) => {
                  const chg = Number(m.change);
                  return (
                    <tr key={m.id}>
                      <td><small>{m.createdAt.toLocaleDateString("en-GB")}</small></td>
                      <td><code>{m.item.sku}</code> · {m.item.name}</td>
                      <td><StatusBadge status={m.type} size="sm" /></td>
                      <td className="numeric" style={{ fontWeight: 700, color: chg >= 0 ? "var(--success)" : "var(--danger)" }}>
                        {chg >= 0 ? `+${chg}` : chg} {m.item.unit}
                      </td>
                      <td className="numeric" style={{ fontWeight: 600 }}>{String(m.balanceAfter)}</td>
                      <td><small>{m.reason || m.sourceType || "—"}</small></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* REPORT 4: EVENT GOODIES REPORT */}
      {activeTab === "events" && (
        <>
          <div
            className="card"
            style={{
              padding: "12px 16px",
              marginBottom: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <strong style={{ fontSize: 14 }}>Event Goodies & Award Distribution Report</strong>
              <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 12 }}>
                Historical report of gifts distributed to event winners and participants.
              </p>
            </div>
            <Link href="/events">
              <button className="ghost" style={{ minHeight: 34, fontSize: 13 }}>
                Manage Events & Goodies
              </button>
            </Link>
          </div>

          <div className="card scroll" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Event Name</th>
                  <th>Employee</th>
                  <th>Goodie Distributed</th>
                  <th className="numeric">Qty</th>
                  <th>Recognition Role</th>
                  <th>POC / Executive</th>
                </tr>
              </thead>
              <tbody>
                {eventDistributions.map((d) => (
                  <tr key={d.id}>
                    <td><small>{d.distributionDate.toLocaleDateString("en-GB")}</small></td>
                    <td><strong>{d.event?.name || d.category || "General Event"}</strong></td>
                    <td><code>{d.employee.empId}</code> · {d.employee.name}</td>
                    <td><code>{d.item.sku}</code> · {d.item.name}</td>
                    <td className="numeric" style={{ fontWeight: 700 }}>{String(d.quantity)} {d.item.unit}</td>
                    <td><StatusBadge status={d.recipientType || "PARTICIPANT"} size="sm" /></td>
                    <td><small>{d.poc || "—"}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* REPORT 5: EMPLOYEE COLLECTION SUMMARY */}
      {activeTab === "employees" && (
        <>
          <div
            className="card"
            style={{
              padding: "12px 16px",
              marginBottom: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <strong style={{ fontSize: 14 }}>Employee Collection Summary Report</strong>
              <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 12 }}>
                High-level view of goodies received by staff across all corporate programs.
              </p>
            </div>
            <Link href="/employees">
              <button className="ghost" style={{ minHeight: 34, fontSize: 13 }}>
                View Employee Directory
              </button>
            </Link>
          </div>

          <div className="card scroll" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Emp ID</th>
                  <th>Name</th>
                  <th>Base Location</th>
                  <th>Department</th>
                  <th className="numeric">Total Units Received</th>
                  <th className="numeric">Distinct Items</th>
                  <th style={{ textAlign: "right" }}>History</th>
                </tr>
              </thead>
              <tbody>
                {employeeSummaries.map((emp) => {
                  const total = emp.distributions.reduce((s, d) => s + Number(d.quantity), 0);
                  const distinct = new Set(emp.distributions.map((d) => d.itemId)).size;
                  return (
                    <tr key={emp.id}>
                      <td><code>{emp.empId}</code></td>
                      <td><strong>{emp.name}</strong></td>
                      <td>{emp.baseLocation}</td>
                      <td>{emp.department || "—"}</td>
                      <td className="numeric" style={{ fontWeight: 700 }}>{total}</td>
                      <td className="numeric">{distinct}</td>
                      <td style={{ textAlign: "right" }}>
                        <Link href={`/employees?tab=lookup&empId=${emp.empId}`}>
                          <button className="ghost" style={{ fontSize: 11, padding: "2px 8px", minHeight: 26 }}>
                            Inspect Profile →
                          </button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* REPORT 6: OFFICIAL SPREADSHEET TEMPLATES */}
      {activeTab === "templates" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {/* Employee Template */}
          <div className="card" style={{ margin: 0, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Users size={18} style={{ color: "var(--accent)" }} />
              <strong style={{ fontSize: 14 }}>Employee Roster Template</strong>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
              Columns: <code>Emp ID</code>, <code>Name</code>, <code>Base Location</code>, <code>Department</code>, <code>Email</code>.
            </p>
            <a href="/api/employees/template" download>
              <button style={{ width: "100%", fontSize: 12.5, minHeight: 34 }}>
                <Download size={14} /> Download Template (.xlsx)
              </button>
            </a>
          </div>

          {/* Stock Count Template */}
          <div className="card" style={{ margin: 0, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Scale size={18} style={{ color: "var(--accent)" }} />
              <strong style={{ fontSize: 14 }}>Stock Count Reconciliation</strong>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
              Columns: <code>S.N</code>, <code>Product Details</code>, <code>Product</code>, <code>Size / Quantity</code>, <code>Color</code>, <code>Brand</code>, <code>Available</code>.
            </p>
            <a href="/templates/Stock_Count_Sample_Valid.xlsx" download>
              <button className="ghost" style={{ width: "100%", fontSize: 12.5, minHeight: 34 }}>
                <Download size={14} /> Download Valid Sample (.xlsx)
              </button>
            </a>
          </div>

          {/* Procurement Template */}
          <div className="card" style={{ margin: 0, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Boxes size={18} style={{ color: "var(--accent)" }} />
              <strong style={{ fontSize: 14 }}>Procurement Import</strong>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
              Columns: <code>Date</code>, <code>Product Details</code>, <code>Product</code>, <code>Size / Quantity</code>, <code>Color</code>, <code>Brand</code>, <code>Procured</code>.
            </p>
            <a href="/templates/Procurement_Sample_Valid.xlsx" download>
              <button className="ghost" style={{ width: "100%", fontSize: 12.5, minHeight: 34 }}>
                <Download size={14} /> Download Valid Sample (.xlsx)
              </button>
            </a>
          </div>
        </div>
      )}
    </>
  );
}
