import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";

export default async function Dashboard() {
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
    pendingRequests,
    myCount,
    totalStock,
    zeroStock,
    recentMoves,
    pendingReconciliations,
    pendingProcurements,
    recentImports,
    needsReview,
    activeEvents,
    activeEmployees,
    eventGoodies,
  ] = await Promise.all([
    db.item.count({ where: { active: true } }),
    db.request.count({ where: { status: { in: ["PENDING_MANAGER", "PENDING_AUTHORITY"] } } }),
    stage
      ? db.request.count({ where: { status: stage } })
      : db.request.count({ where: { requesterId: u.id } }),
    // Total available stock across all items
    db.item
      .aggregate({ _sum: { quantity: true }, where: { active: true } })
      .then((r) => Number(r._sum.quantity ?? 0)),
    db.item.count({ where: { active: true, quantity: 0 } }),
    // Last 5 stock movements
    db.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { item: { select: { sku: true, name: true } } },
    }),
    // Pending reconciliation approvals
    db.reconciliationReview
      .count({ where: { status: "PENDING_APPROVAL" } })
      .catch(() => 0),
    // Pending procurement approvals
    db.procurementRecord
      .count({ where: { status: "PENDING" } })
      .catch(() => 0),
    // Last 5 import jobs
    db.importJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { uploadedBy: { select: { name: true } } },
    }),
    // Requests in NEEDS_REVIEW
    db.request.count({ where: { status: "NEEDS_REVIEW" } }),
    // Active events
    db.event.count({ where: { status: "ACTIVE" } }).catch(() => 0),
    // Total employees
    db.employee.count({ where: { active: true } }).catch(() => 0),
    // Event goodies awarded
    db.distributionRecord
      .count({ where: { OR: [{ eventId: { not: null } }, { recipientType: { not: null } }] } })
      .catch(() => 0),
  ]);

  return (
    <>
      <div className="page-head">
        <div><h1>Dashboard</h1><p>Operational overview for your inventory workspace.</p></div>
        <small>Updated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</small>
      </div>

      {/* Key metrics */}
      <div className="grid">
        <Link href="/inventory" className="card metric-link">
          <span className="metric-label">Active variants</span>
          <div className="big">{itemCount}</div>
        </Link>
        <Link href="/inventory" className="card metric-link">
          <span className="metric-label">Total stock on hand</span>
          <div className="big">{totalStock.toLocaleString()}</div>
        </Link>
        <Link href="/inventory" className="card metric-link">
          <span className="metric-label">Zero-stock variants</span>
          <div className="big" style={zeroStock > 0 ? { color: "var(--warning)" } : undefined}>{zeroStock}</div>
        </Link>
        <Link href="/requests" className="card metric-link">
          <span className="metric-label">Pending distribution requests</span>
          <div className="big" style={pendingRequests > 0 ? { color: "var(--warning)" } : undefined}>
            {pendingRequests}
          </div>
        </Link>
        <Link href={isApprover ? "/approvals" : "/requests"} className="card metric-link">
          <span className="metric-label">{stage ? "Awaiting your approval" : "Your requests"}</span>
          <div className="big" style={myCount > 0 ? { color: "var(--warning)" } : undefined}>
            {myCount}
          </div>
        </Link>
        <Link href="/events" className="card metric-link">
          <span className="metric-label">Active Events</span>
          <div className="big" style={{ color: "var(--accent)" }}>{activeEvents}</div>
        </Link>
        <Link href="/events" className="card metric-link">
          <span className="metric-label">Event Goodies Awarded</span>
          <div className="big">{eventGoodies}</div>
        </Link>
        <Link href="/employees" className="card metric-link">
          <span className="metric-label">Employees Tracked</span>
          <div className="big">{activeEmployees}</div>
        </Link>
        {needsReview > 0 && (
          <Link href="/requests?status=NEEDS_REVIEW" className="card">
            <span className="metric-label">Requests needing review</span>
            <div className="big" style={{ color: "var(--danger)" }}>
              {needsReview}
            </div>
          </Link>
        )}
        {pendingReconciliations > 0 && (
          <div className="card">
            <span className="metric-label">Pending reconciliation approvals</span>
            <div className="big" style={{ color: "var(--warning)" }}>
              {pendingReconciliations}
            </div>
          </div>
        )}
        {pendingProcurements > 0 && (
          <div className="card">
            <span className="metric-label">Pending procurement approvals</span>
            <div className="big" style={{ color: "var(--warning)" }}>
              {pendingProcurements}
            </div>
          </div>
        )}
      </div>

      {/* Recent stock movements */}
      {recentMoves.length > 0 && (
        <>
          <h2>Recent stock movements</h2>
          <div className="card scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Change</th>
                  <th>Balance after</th>
                </tr>
              </thead>
              <tbody>
                {recentMoves.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <small>{m.createdAt.toLocaleDateString("en-GB")}</small>
                    </td>
                    <td>
                      {m.item.sku} · {m.item.name}
                    </td>
                    <td>
                      <small>{m.type}</small>
                    </td>
                    <td
                      style={{
                        color: Number(m.change) >= 0 ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      {Number(m.change) >= 0 ? "+" : ""}
                      {String(m.change)}
                    </td>
                    <td>{String(m.balanceAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Recent import jobs (ADMIN only) */}
      {u.role === "ADMIN" && recentImports.length > 0 && (
        <>
          <h2>Recent imports</h2>
          <div className="card scroll">
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentImports.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <Link href={`/imports/${j.id}`}>{j.filename}</Link>
                    </td>
                    <td>
                      <small>
                        {j.type} / {j.mode}
                      </small>
                    </td>
                    <td>
                      <span
                        className={`badge ${j.status === "COMMITTED" ? "APPROVED" : j.status === "FAILED" ? "REJECTED" : ""}`}
                      >
                        {j.status.toLowerCase()}
                      </span>
                    </td>
                    <td>
                      <small>{j.uploadedBy.name}</small>
                    </td>
                    <td>
                      <small>{j.createdAt.toLocaleDateString("en-GB")}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
