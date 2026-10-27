import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StockIndicator } from "@/components/ui/stock-indicator";
import {
  Boxes,
  ClipboardList,
  AlertTriangle,
  Gift,
  Users,
  CheckCircle2,
  Calendar,
  History,
  ArrowRight,
  Plus,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const u = await requireUser();
  const isApprover = u.role === "MANAGER" || u.role === "AUTHORITY";
  const stage =
    u.role === "MANAGER"
      ? "PENDING_MANAGER"
      : u.role === "AUTHORITY"
      ? "PENDING_AUTHORITY"
      : null;

  const [
    itemCount,
    totalStockAgg,
    lowStockCount,
    zeroStockCount,
    pendingRequestsCount,
    myPendingCount,
    needsReviewCount,
    activeEventsCount,
    totalGoodiesDistributed,
    activeEmployeesCount,
    // Operational insight lists
    lowStockAlerts,
    actionableRequests,
    recentMoves,
    recentDistributions,
  ] = await Promise.all([
    // KPIs
    db.item.count({ where: { active: true } }),
    db.item.aggregate({ _sum: { quantity: true }, where: { active: true } }),
    db.item.count({ where: { active: true, quantity: { gt: 0, lte: 10 } } }),
    db.item.count({ where: { active: true, quantity: { lte: 0 } } }),
    db.request.count({ where: { status: { in: ["PENDING_MANAGER", "PENDING_AUTHORITY"] } } }),
    stage ? db.request.count({ where: { status: stage, requesterId: { not: u.id } } }) : 0,
    db.request.count({ where: { status: "NEEDS_REVIEW" } }),
    db.event.count({ where: { status: "ACTIVE" } }).catch(() => 0),
    // Authoritative count of posted goodies
    db.distributionRecord
      .count({
        where: {
          OR: [{ eventId: { not: null } }, { recipientType: { not: null } }],
          status: "POSTED",
        },
      })
      .catch(() => 0),
    db.employee.count({ where: { active: true } }).catch(() => 0),

    // Feeds
    db.item.findMany({
      where: { active: true, quantity: { lte: 10 } },
      orderBy: { quantity: "asc" },
      take: 6,
    }),
    db.request.findMany({
      where: stage
        ? { status: stage, requesterId: { not: u.id } }
        : { status: { in: ["PENDING_MANAGER", "PENDING_AUTHORITY", "NEEDS_REVIEW"] } },
      orderBy: { number: "desc" },
      take: 6,
      include: {
        requester: { select: { name: true } },
        _count: { select: { lines: true } },
      },
    }),
    db.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { item: { select: { sku: true, name: true, unit: true } } },
    }),
    db.distributionRecord.findMany({
      where: { status: "POSTED" },
      orderBy: { distributionDate: "desc" },
      take: 6,
      include: {
        item: { select: { sku: true, name: true, unit: true } },
        employee: { select: { empId: true, name: true } },
        event: { select: { name: true } },
      },
    }),
  ]);

  const totalStock = Number(totalStockAgg._sum.quantity ?? 0);

  return (
    <>
      <PageHeader
        title="Operations Command Center"
        description="Unified live view of inventory stock balances, pending approval queues, corporate events, and goodies distribution."
        actions={
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/requests/new">
              <button className="ghost" style={{ minHeight: 34, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Plus size={14} /> New Request
              </button>
            </Link>
            <Link href="/events">
              <button style={{ minHeight: 34, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Gift size={14} /> Events & Goodies
              </button>
            </Link>
          </div>
        }
      />

      {/* KPI Section */}
      <div className="grid" style={{ marginBottom: 20 }}>
        <KpiCard
          label="Catalog Items"
          value={itemCount}
          subtext="Active SKUs in catalog"
          href="/inventory"
          icon={Boxes}
        />
        <KpiCard
          label="Total Stock On Hand"
          value={totalStock.toLocaleString()}
          subtext="Available units across variants"
          href="/inventory"
          variant="success"
          icon={CheckCircle2}
        />
        <KpiCard
          label="Stock Deficits"
          value={lowStockCount + zeroStockCount}
          subtext={`${zeroStockCount} depleted, ${lowStockCount} below minimum`}
          href="/reports?tab=low_stock"
          variant={zeroStockCount > 0 ? "danger" : lowStockCount > 0 ? "warning" : "default"}
          icon={AlertTriangle}
        />
        <KpiCard
          label="Pending Approvals"
          value={isApprover ? myPendingCount : pendingRequestsCount}
          subtext={isApprover ? `Awaiting your decision (${u.role})` : `${pendingRequestsCount} in workflow queues`}
          href={isApprover ? "/approvals" : "/requests"}
          variant={myPendingCount > 0 ? "warning" : "default"}
          icon={ClipboardList}
        />
        <KpiCard
          label="Event Goodies Posted"
          value={totalGoodiesDistributed}
          subtext={`${activeEventsCount} active events tracked`}
          href="/events"
          icon={Gift}
        />
        <KpiCard
          label="Active Staff Roster"
          value={activeEmployeesCount}
          subtext="Enrolled employee identities"
          href="/employees"
          icon={Users}
        />
      </div>

      {/* Row 1: Stock Requiring Attention (Left) + Recent Stock Movements (Right) */}
      <div className="dashboard-grid-row">
        {/* Cell 1: Stock Requiring Attention */}
        <div className="dashboard-cell">
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
                <AlertTriangle size={16} style={{ color: "var(--warning)" }} />
                <strong style={{ fontSize: 14 }}>Stock Requiring Attention</strong>
              </div>
              <Link href="/reports?tab=low_stock" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
                View All Deficits →
              </Link>
            </div>
            <div className="table-container">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-subtle)", borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>SKU</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Variant Name</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Category</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 12 }}>Balance</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 12 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockAlerts.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px 14px" }}>
                        <code>{item.sku}</code>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <Link href={`/inventory/${item.id}`}>
                          <strong style={{ fontSize: 13, color: "var(--foreground)" }}>{item.name}</strong>
                        </Link>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted)" }}>
                        {item.category}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        <StockIndicator quantity={Number(item.quantity)} unit={item.unit} />
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        {Number(item.quantity) <= 0 ? (
                          <span className="badge REJECTED" style={{ fontSize: 10.5 }}>
                            Depleted
                          </span>
                        ) : (
                          <span className="badge PENDING" style={{ fontSize: 10.5 }}>
                            Low Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!lowStockAlerts.length && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "32px 0", color: "var(--muted)" }}>
                        All items maintain healthy stock levels.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Cell 2: Recent Stock Movements */}
        <div className="dashboard-cell">
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
                <History size={16} style={{ color: "var(--accent)" }} />
                <strong style={{ fontSize: 14 }}>Recent Stock Movements</strong>
              </div>
              <Link href="/distribution" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
                Full Ledger →
              </Link>
            </div>
            <div className="table-container">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-subtle)", borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>SKU</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Type</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 12 }}>Delta</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 12 }}>Balance</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMoves.map((m) => {
                    const chg = Number(m.change);
                    return (
                      <tr key={m.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "12px 14px" }}>
                          <Link href={`/inventory/${m.itemId}`}>
                            <code style={{ fontSize: 11 }}>{m.item.sku}</code>
                          </Link>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <StatusBadge status={m.type} size="sm" />
                        </td>
                        <td
                          style={{
                            padding: "12px 14px",
                            textAlign: "right",
                            fontWeight: 700,
                            color: chg >= 0 ? "var(--success)" : "var(--danger)",
                            fontSize: 12.5,
                          }}
                        >
                          {chg >= 0 ? `+${chg}` : chg} {m.item.unit}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600, fontSize: 12.5 }}>
                          {String(m.balanceAfter)}
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 11.5, color: "var(--muted)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.reason || "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {!recentMoves.length && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "32px 0", color: "var(--muted)" }}>
                        No stock movements recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Pending Workflow Requests (Left) + Corporate Events Activity (Right) */}
      <div className="dashboard-grid-row">
        {/* Cell 1: Actionable Requests */}
        <div className="dashboard-cell">
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
                <ClipboardList size={16} style={{ color: "var(--accent)" }} />
                <strong style={{ fontSize: 14 }}>
                  {isApprover ? "Requests Awaiting Your Review" : "Pending Workflow Requests"}
                </strong>
              </div>
              <Link href={isApprover ? "/approvals" : "/requests"} style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
                View Queue →
              </Link>
            </div>
            <div className="table-container">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-subtle)", borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Ref</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Requester</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Items</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 12 }}>Status</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 12 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {actionableRequests.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px 14px" }}>
                        <Link href={`/requests/${r.id}`}>
                          <code style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent)" }}>
                            REQ-{String(r.number).padStart(5, "0")}
                          </code>
                        </Link>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 13 }}>{r.requester.name}</td>
                      <td style={{ padding: "12px 14px", fontSize: 12 }}>{r._count.lines} item line(s)</td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <StatusBadge status={r.status} size="sm" />
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        <Link href={`/requests/${r.id}`}>
                          <button className="ghost" style={{ fontSize: 11, padding: "2px 8px", minHeight: 26 }}>
                            Inspect →
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!actionableRequests.length && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "32px 0", color: "var(--muted)" }}>
                        No requests currently awaiting decision.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Cell 2: Corporate Events & Goodies Activity */}
        <div className="dashboard-cell">
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
                <Gift size={16} style={{ color: "var(--accent)" }} />
                <strong style={{ fontSize: 14 }}>Authoritative Goodies Distributed</strong>
              </div>
              <Link href="/events" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
                Events Center →
              </Link>
            </div>
            <div className="table-container">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-subtle)", borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Event / Program</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Recipient</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12 }}>Goodie</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 12 }}>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDistributions.map((d) => (
                    <tr key={d.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px 14px" }}>
                        <strong style={{ fontSize: 13 }}>{d.event?.name || "Corporate Distribution"}</strong>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <Link href={`/employees?tab=lookup&empId=${d.employee.empId}`}>
                          <code style={{ fontSize: 11 }}>{d.employee.empId}</code> · {d.employee.name}
                        </Link>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12.5 }}>{d.item.name}</td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <StatusBadge status={d.recipientType || "PARTICIPANT"} size="sm" />
                      </td>
                    </tr>
                  ))}
                  {!recentDistributions.length && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "32px 0", color: "var(--muted)" }}>
                        No event distributions logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
