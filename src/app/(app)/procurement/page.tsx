import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { 
  Truck, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  UploadCloud, 
  Clock, 
  CheckCircle2, 
  PackagePlus,
  Calendar,
  Layers
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProcurementHistory({
  searchParams,
}: {
  searchParams: { page?: string; mode?: string; status?: string; q?: string };
}) {
  await requireUser();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = 50;
  const modeFilter = searchParams.mode as string | undefined;
  const statusFilter = searchParams.status as string | undefined;
  const q = searchParams.q?.trim();

  const where: Record<string, unknown> = {};
  if (modeFilter) where.mode = modeFilter;
  if (statusFilter) where.status = statusFilter;
  if (q) {
    where.item = {
      OR: [
        { sku: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  const [records, total, totalQtyAgg, pendingCount, postedCount] = await Promise.all([
    db.procurementRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        item: { select: { sku: true, name: true, category: true } },
        importJob: { select: { filename: true, id: true } },
        approver: { select: { name: true } },
      },
    }),
    db.procurementRecord.count({ where }),
    db.procurementRecord.aggregate({
      where,
      _sum: { quantity: true },
    }),
    db.procurementRecord.count({ where: { status: "PENDING" } }),
    db.procurementRecord.count({ where: { status: "POSTED" } }),
  ]);

  const totalQuantity = Number(totalQtyAgg._sum.quantity || 0);
  const pages = Math.ceil(total / pageSize);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader
        title="Procurement"
        description="Supplier purchases, inbound replenishment logs, and inventory stock-in ledger records."
        breadcrumbs={[
          { label: "Operations" },
          { label: "Procurement" },
        ]}
        actions={
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/imports" className="btn secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <UploadCloud size={15} /> Upload Procurement
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
          label="Total Procurement Records"
          value={total.toLocaleString()}
          subtext="Inbound purchase logs"
          icon={<Truck size={18} />}
        />
        <KpiCard
          label="Total Units Procured"
          value={totalQuantity.toLocaleString()}
          subtext="Physical items received"
          icon={<PackagePlus size={18} />}
        />
        <KpiCard
          label="Pending Authorizations"
          value={pendingCount.toLocaleString()}
          subtext="Awaiting stock-in approval"
          variant={pendingCount > 0 ? "warning" : "default"}
          icon={<Clock size={18} />}
        />
        <KpiCard
          label="Posted Receipts"
          value={postedCount.toLocaleString()}
          subtext="Committed to active balance"
          variant="success"
          icon={<CheckCircle2 size={18} />}
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

        <div style={{ flex: "0 1 180px" }}>
          <label htmlFor="mode" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 6 }}>
            <Layers size={14} /> Inbound Mode
          </label>
          <select id="mode" name="mode" defaultValue={modeFilter ?? ""} style={{ width: "100%" }}>
            <option value="">All modes</option>
            <option value="NEW">New (Creates Stock-In)</option>
            <option value="HISTORICAL">Historical (Provenance Only)</option>
          </select>
        </div>

        <div style={{ flex: "0 1 180px" }}>
          <label htmlFor="status" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 6 }}>
            <Filter size={14} /> Status
          </label>
          <select id="status" name="status" defaultValue={statusFilter ?? ""} style={{ width: "100%" }}>
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="POSTED">Posted</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Filter size={14} /> Apply Filter
          </button>
          {(q || modeFilter || statusFilter) && (
            <Link href="/procurement" className="btn secondary">
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* Procurement Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
            Procurement Logs ({total.toLocaleString()} records)
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
                <th>Mode</th>
                <th>Item & SKU</th>
                <th className="numeric">Quantity</th>
                <th>Status</th>
                <th>Import Source</th>
                <th>Approver</th>
                <th>Approved Date</th>
                <th>Movement Ref</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500 }}>
                      <Calendar size={13} style={{ color: "var(--foreground-subtle)" }} />
                      {r.procurementDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--foreground-subtle)", marginTop: 2 }}>
                      Logged {r.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={r.mode === "HISTORICAL" ? "HISTORICAL" : "APPROVED"} />
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
                  <td className="numeric">
                    <span 
                      style={{ 
                        display: "inline-flex", 
                        alignItems: "center", 
                        padding: "2px 8px", 
                        borderRadius: 4, 
                        fontWeight: 700, 
                        fontSize: 13,
                        background: "rgba(16, 185, 129, 0.08)",
                        color: "var(--success)"
                      }}
                    >
                      +{String(r.quantity)}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>
                    {r.importJob ? (
                      <Link 
                        href={`/imports/${r.importJob.id}`} 
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--primary)", textDecoration: "none" }}
                      >
                        <FileSpreadsheet size={13} /> {r.importJob.filename}
                      </Link>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--foreground-muted)" }}>Manual Entry</span>
                    )}
                    {r.sourceRow && (
                      <div style={{ fontSize: 10, color: "var(--foreground-subtle)" }}>
                        Row #{r.sourceRow}
                      </div>
                    )}
                  </td>
                  <td>
                    {r.approver?.name ? (
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
                        {r.approver.name}
                      </div>
                    ) : (
                      <span style={{ color: "var(--foreground-subtle)", fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td>
                    {r.approvedAt ? (
                      <div style={{ fontSize: 12, color: "var(--foreground-muted)" }}>
                        {r.approvedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
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
              ))}
            </tbody>
          </table>
        </div>

        {!records.length && (
          <EmptyState
            icon={<Truck size={32} />}
            title="No procurement records found"
            description={
              q || modeFilter || statusFilter
                ? "No procurement records match your filter criteria. Try resetting the filters."
                : "No inbound shipments or procurement files have been logged yet. Upload an Excel procurement workbook to begin."
            }
            action={
              (q || modeFilter || statusFilter) ? (
                <Link href="/procurement" className="btn secondary">
                  Reset Filters
                </Link>
              ) : (
                <Link href="/imports" className="btn primary">
                  Upload Procurement
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
                  href={`/procurement?page=${page - 1}${modeFilter ? `&mode=${modeFilter}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className="btn secondary"
                >
                  ← Previous
                </Link>
              )}
              {page < pages && (
                <Link
                  href={`/procurement?page=${page + 1}${modeFilter ? `&mode=${modeFilter}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
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
