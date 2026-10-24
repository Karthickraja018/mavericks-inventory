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
    recentMoves,
    pendingReconciliations,
    pendingProcurements,
    recentImports,
    needsReview,
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
  ]);

  return (
    <>
      <h1>Dashboard</h1>

      {/* Key metrics */}
      <div className="grid">
        <Link href="/inventory" className="card">
          <small>Active items</small>
          <div className="big">{itemCount}</div>
        </Link>
        <Link href="/inventory" className="card">
          <small>Total stock on hand</small>
          <div className="big">{totalStock.toLocaleString()}</div>
        </Link>
        <Link href="/requests" className="card">
          <small>Pending distribution requests</small>
          <div className="big" style={pendingRequests > 0 ? { color: "var(--warn)" } : undefined}>
            {pendingRequests}
          </div>
        </Link>
        <Link href={isApprover ? "/approvals" : "/requests"} className="card">
          <small>{stage ? "Awaiting your approval" : "Your requests"}</small>
          <div className="big" style={myCount > 0 ? { color: "var(--warn)" } : undefined}>
            {myCount}
          </div>
        </Link>
        {needsReview > 0 && (
          <Link href="/requests?status=NEEDS_REVIEW" className="card">
            <small>Requests needing review</small>
            <div className="big" style={{ color: "var(--bad)" }}>
              {needsReview}
            </div>
          </Link>
        )}
        {pendingReconciliations > 0 && (
          <div className="card">
            <small>Pending reconciliation approvals</small>
            <div className="big" style={{ color: "var(--warn)" }}>
              {pendingReconciliations}
            </div>
          </div>
        )}
        {pendingProcurements > 0 && (
          <div className="card">
            <small>Pending procurement approvals</small>
            <div className="big" style={{ color: "var(--warn)" }}>
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
                        color: Number(m.change) >= 0 ? "var(--acc)" : "var(--bad)",
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
