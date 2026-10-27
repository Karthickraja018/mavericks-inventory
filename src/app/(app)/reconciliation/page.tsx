import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { 
  Scale, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  UploadCloud,
  Layers,
  Calendar
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReconciliationHistory({
  searchParams,
}: {
  searchParams: { page?: string; status?: string; q?: string };
}) {
  await requireUser();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = 50;
  const statusFilter = searchParams.status as string | undefined;
  const q = searchParams.q?.trim();

  const where: Record<string, unknown> = {};
  if (statusFilter) where.status = statusFilter;
  if (q) {
    where.item = {
      OR: [
        { sku: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  const [records, total, pendingCount, postedCount, rejectedCount] = await Promise.all([
    db.reconciliationReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        item: { select: { sku: true, name: true, category: true } },
        importJob: { select: { filename: true, id: true } },
        requester: { select: { name: true } },
        reviewer: { select: { name: true } },
      },
    }),
    db.reconciliationReview.count({ where }),
    db.reconciliationReview.count({ where: { status: "PENDING_APPROVAL" } }),
    db.reconciliationReview.count({ where: { status: "POSTED" } }),
    db.reconciliationReview.count({ where: { status: "REJECTED" } }),
  ]);

  const pages = Math.ceil(total / pageSize);
  const STATUSES = ["PENDING_APPROVAL", "APPROVED", "REJECTED", "POSTED"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader
        title="Reconciliation"
        description="Physical stock count verification, discrepancy analysis, and authoritative balance adjustments."
        breadcrumbs={[
          { label: "Operations" },
          { label: "Reconciliation" },
        ]}
        actions={
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/imports" className="btn secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <UploadCloud size={15} /> Upload Stock Count
            </Link>
            {pendingCount > 0 && (
              <Link href="/approvals" className="btn primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Clock size={15} /> Review Pending ({pendingCount})
              </Link>
            )}
          </div>
        }
      />

      {/* KPI Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <KpiCard
          label="Total Counts Reviewed"
          value={total.toLocaleString()}
          subtext="Inventory line counts"
          icon={<Scale size={18} />}
        />
        <KpiCard
          label="Awaiting Approval"
          value={pendingCount.toLocaleString()}
          subtext="Requires manager authorization"
          variant={pendingCount > 0 ? "warning" : "default"}
          icon={<Clock size={18} />}
        />
        <KpiCard
          label="Posted Adjustments"
          value={postedCount.toLocaleString()}
          subtext="Committed to ledger balance"
          variant="success"
          icon={<CheckCircle2 size={18} />}
        />
        <KpiCard
          label="Rejected Counts"
          value={rejectedCount.toLocaleString()}
          subtext="Disapproved count entries"
          icon={<XCircle size={18} />}
        />
      </div>

      {/* Filter and Search Bar */}
      <form 
        className="card" 
        style={{ 
          display: "flex", 
          flexWrap: "wrap", 
          gap: 14, 
          padding: "16px 20px", 
          alignItems: "flex-end",
          background: "var(--surface)"
        }}
      >
        <div style={{ flex: "1 1 240px" }}>
          <label htmlFor="q" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 6 }}>
            <Search size={14} /> Search Item or SKU
          </label>
          <input 
            id="q" 
            name="q" 
            defaultValue={q} 
            placeholder="Search by SKU or item name…" 
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ flex: "0 1 200px" }}>
          <label htmlFor="status" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 6 }}>
            <Filter size={14} /> Reconciliation Status
          </label>
          <select id="status" name="status" defaultValue={statusFilter ?? ""} style={{ width: "100%" }}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ").toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Filter size={14} /> Apply Filter
          </button>
          {(q || statusFilter) && (
            <Link href="/reconciliation" className="btn secondary">
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* Reconciliation Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
            Stock Verification Log ({total.toLocaleString()} records)
          </div>
          <div style={{ fontSize: 12, color: "var(--foreground-subtle)" }}>
            Showing page {page} of {Math.max(1, pages)}
          </div>
        </div>

        <div className="table-container" style={{ margin: 0, border: "none" }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Item & SKU</th>
                <th className="numeric">Balance Before</th>
                <th className="numeric">Target (Counted)</th>
                <th className="numeric">Variance</th>
                <th>Status</th>
                <th>Import Source</th>
                <th>Requester</th>
                <th>Reviewer</th>
                <th>Movement Ref</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const variance = Number(r.variance);
                return (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500 }}>
                        <Calendar size={13} style={{ color: "var(--foreground-subtle)" }} />
                        {r.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--foreground-subtle)", marginTop: 2 }}>
                        {r.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>
                    <td>
                      <Link 
                        href={`/inventory/${r.itemId}`} 
                        style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}
                      >
                        {r.item.name}
                      </Link>
                      <div style={{ fontSize: 11, color: "var(--foreground-subtle)", marginTop: 2 }}>
                        <code style={{ fontSize: 10 }}>{r.item.sku}</code> {r.item.category ? `· ${r.item.category}` : ""}
                      </div>
                    </td>
                    <td className="numeric" style={{ color: "var(--foreground-muted)", fontWeight: 500 }}>
                      {String(r.balanceBefore)}
                    </td>
                    <td className="numeric" style={{ fontWeight: 600 }}>
                      {String(r.targetBalance)}
                    </td>
                    <td className="numeric">
                      <span 
                        style={{ 
                          display: "inline-flex", 
                          alignItems: "center", 
                          padding: "2px 8px", 
                          borderRadius: 4, 
                          fontWeight: 700, 
                          fontSize: 12,
                          background: variance > 0 ? "rgba(16, 185, 129, 0.08)" : variance < 0 ? "rgba(239, 68, 68, 0.08)" : "var(--background-subtle)",
                          color: variance > 0 ? "var(--success)" : variance < 0 ? "var(--danger)" : "var(--foreground-muted)"
                        }}
                      >
                        {variance > 0 ? `+${variance}` : String(variance)}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>
                      <Link 
                        href={`/imports/${r.importJob.id}`} 
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--primary)", textDecoration: "none" }}
                      >
                        <FileSpreadsheet size={13} /> {r.importJob.filename}
                      </Link>
                      <div style={{ fontSize: 10, color: "var(--foreground-subtle)" }}>
                        Row #{r.sourceRow}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
                        {r.requester.name}
                      </div>
                    </td>
                    <td>
                      {r.reviewer?.name ? (
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
                          {r.reviewer.name}
                        </div>
                      ) : (
                        <span style={{ color: "var(--foreground-subtle)", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td>
                      {r.movementId ? (
                        <code style={{ fontSize: 11, padding: "2px 6px", background: "var(--background-subtle)", borderRadius: 4 }}>
                          …{r.movementId.slice(-8)}
                        </code>
                      ) : (
                        <span style={{ color: "var(--foreground-subtle)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!records.length && (
          <EmptyState
            icon={<Scale size={32} />}
            title="No reconciliation records found"
            description={
              q || statusFilter
                ? "No verification records match your filter criteria. Try resetting the filters."
                : "No stock reconciliation records have been generated. Upload an Excel stock count workbook to initiate reconciliation."
            }
            action={
              (q || statusFilter) ? (
                <Link href="/reconciliation" className="btn secondary">
                  Reset Filters
                </Link>
              ) : (
                <Link href="/imports" className="btn primary">
                  Upload Stock Count
                </Link>
              )
            }
          />
        )}

        {/* Pagination Bar */}
        {pages > 1 && (
          <div 
            style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              padding: "12px 20px", 
              borderTop: "1px solid var(--border-subtle)" 
            }}
          >
            <div style={{ fontSize: 13, color: "var(--foreground-subtle)" }}>
              Page {page} of {pages} ({total.toLocaleString()} total entries)
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {page > 1 && (
                <Link
                  href={`/reconciliation?page=${page - 1}${statusFilter ? `&status=${statusFilter}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className="btn secondary"
                >
                  ← Previous
                </Link>
              )}
              {page < pages && (
                <Link
                  href={`/reconciliation?page=${page + 1}${statusFilter ? `&status=${statusFilter}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className="btn secondary"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

