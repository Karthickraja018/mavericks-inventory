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
    activeEventsList,
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
    db.distributionRecord
      .count({ where: { OR: [{ eventId: { not: null } }, { recipientType: { not: null } }] } })
      .catch(() => 0),
    db.employee.count({ where: { active: true } }).catch(() => 0),

    // Feeds
    db.item.findMany({
      where: { active: true, quantity: { lte: 10 } },
      orderBy: { quantity: "asc" },
      take: 5,
    }),
    db.request.findMany({
      where: stage
        ? { status: stage, requesterId: { not: u.id } }
        : { status: { in: ["PENDING_MANAGER", "PENDING_AUTHORITY", "NEEDS_REVIEW"] } },
      orderBy: { number: "desc" },
      take: 5,
      include: {
        requester: { select: { name: true } },
        _count: { select: { lines: true } },
      },
    }),
    db.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { item: { select: { sku: true, name: true, unit: true } } },
    }),
    db.distributionRecord.findMany({
      orderBy: { distributionDate: "desc" },
      take: 5,
      include: {
        item: { select: { sku: true, name: true, unit: true } },
        employee: { select: { empId: true, name: true } },
        event: { select: { name: true } },
      },
    }),
    db.event.findMany({
      where: { status: "ACTIVE" },
      orderBy: { date: "asc" },
      take: 4,
    }),
  ]);

  const totalStock = Number(totalStockAgg._sum.quantity ?? 0);

  return (
    <>
      <PageHeader
        title="Operations Command Center"
        description="Unified live view of inventory stock balances, pending approval queues, corporate events, and goodies distribution."
        breadcrumbs={[{ label: "Workspace" }, { label: "Overview" }]}
        actions={
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/requests/new">
              <button className="ghost" style={{ minHeight: 34, fontSize: 13 }}>
                <Plus size={14} /> New Request
              </button>
            </Link>
            <Link href="/events">
              <button style={{ minHeight: 34, fontSize: 13 }}>
                <Gift size={14} /> Distribute Goodie
              </button>
            </Link>
          </div>
        }
      />

      {/* KPI Section - Operational Density */}
      <div className="grid" style={{ marginBottom: 24 }}>
        <KpiCard
          label="Active Product Variants"
          value={itemCount}
          subtext="Catalog items in circulation"
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
          label="Low & Out of Stock"
          value={lowStockCount + zeroStockCount}
          subtext={`${zeroStockCount} depleted, ${lowStockCount} below threshold`}
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
          label="Event Goodies Awarded"
          value={totalGoodiesDistributed}
          subtext={`${activeEventsCount} active events tracked`}
          href="/events"
          icon={Gift}
        />
        <KpiCard
          label="Employees Tracked"
          value={activeEmployeesCount}
          subtext="Active staff roster"
          href="/employees"
          icon={Users}
        />
      </div>

      {/* Two-Column Operational Activity Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 20, marginBottom: 24 }}>
        {/* Left Column: Stock Requiring Attention & Requests */}
        <div style={{ display: "grid", gap: 20 }}>
          {/* Critical Stock Card */}
          <div className="card" style={{ margin: 0, padding: 0 }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={16} style={{ color: "var(--warning)" }} />
                <strong style={{ fontSize: 14 }}>Stock Requiring Attention</strong>
              </div>
              <Link href="/reports?tab=low_stock" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
                View All Deficits →
              </Link>
            </div>
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Variant Name</th>
                  <th>Category</th>
                  <th className="numeric">Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lowStockAlerts.map((item) => (
                  <tr key={item.id}>
                    <td><code>{item.sku}</code></td>
                    <td><Link href={`/inventory/${item.id}`}><strong>{item.name}</strong></Link></td>
                    <td><small>{item.category}</small></td>
                    <td className="numeric"><StockIndicator quantity={Number(item.quantity)} unit={item.unit} /></td>
                    <td>
                      {Number(item.quantity) <= 0 ? (
                        <span className="badge REJECTED" style={{ fontSize: 10.5 }}>Depleted</span>
                      ) : (
                        <span className="badge PENDING" style={{ fontSize: 10.5 }}>Low Stock</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!lowStockAlerts.length && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)" }}>
                      All items maintain healthy stock levels.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Actionable Requests */}
          <div className="card" style={{ margin: 0, padding: 0 }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
            <table>
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Requester</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {actionableRequests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/requests/${r.id}`}>
                        <code style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent)" }}>
                          REQ-{String(r.number).padStart(5, "0")}
                        </code>
                      </Link>
                    </td>
                    <td>{r.requester.name}</td>
                    <td>{r._count.lines} item(s)</td>
                    <td><StatusBadge status={r.status} size="sm" /></td>
                    <td style={{ textAlign: "right" }}>
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
                    <td colSpan={5} style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)" }}>
                      No requests currently awaiting decision.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Recent Stock Movements & Events Activity */}
        <div style={{ display: "grid", gap: 20 }}>
          {/* Recent Stock Movements Feed */}
          <div className="card" style={{ margin: 0, padding: 0 }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <History size={16} style={{ color: "var(--accent)" }} />
                <strong style={{ fontSize: 14 }}>Recent Stock Movements</strong>
              </div>
              <Link href="/distribution" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
                Full Ledger →
              </Link>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th className="numeric">Delta</th>
                  <th className="numeric">Balance After</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {recentMoves.map((m) => {
                  const chg = Number(m.change);
                  return (
                    <tr key={m.id}>
                      <td>
                        <Link href={`/inventory/${m.itemId}`}>
                          <code style={{ fontSize: 11 }}>{m.item.sku}</code>
                        </Link>
                      </td>
                      <td><StatusBadge status={m.type} size="sm" /></td>
                      <td
                        className="numeric"
                        style={{
                          fontWeight: 700,
                          color: chg >= 0 ? "var(--success)" : "var(--danger)",
                        }}
                      >
                        {chg >= 0 ? `+${chg}` : chg} {m.item.unit}
                      </td>
                      <td className="numeric" style={{ fontWeight: 600 }}>{String(m.balanceAfter)}</td>
                      <td><small style={{ color: "var(--muted)" }}>{m.reason ? m.reason.slice(0, 30) : "—"}</small></td>
                    </tr>
                  );
                })}
                {!recentMoves.length && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)" }}>
                      No stock movements recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Active Events & Recent Goodie Distributions */}
          <div className="card" style={{ margin: 0, padding: 0 }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Gift size={16} style={{ color: "var(--accent)" }} />
                <strong style={{ fontSize: 14 }}>Active Events & Distributions</strong>
              </div>
              <Link href="/events" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
                Events Center →
              </Link>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Event / Program</th>
                  <th>Recipient</th>
                  <th>Goodie</th>
                  <th>Recognition</th>
                </tr>
              </thead>
              <tbody>
                {recentDistributions.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.event?.name || "General"}</strong></td>
                    <td>
                      <Link href={`/employees?tab=lookup&empId=${d.employee.empId}`}>
                        <code style={{ fontSize: 11 }}>{d.employee.empId}</code> · {d.employee.name}
                      </Link>
                    </td>
                    <td>{d.item.name}</td>
                    <td><StatusBadge status={d.recipientType || "PARTICIPANT"} size="sm" /></td>
                  </tr>
                ))}
                {!recentDistributions.length && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)" }}>
                      No event distributions logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
