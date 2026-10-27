import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Gift, 
  FileSpreadsheet, 
  ArrowRight,
  User,
  Package,
  Calendar,
  Layers
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DistributionHistory({
  searchParams,
}: {
  searchParams: { page?: string; mode?: string; q?: string };
}) {
  await requireUser();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = 50;
  const modeFilter = searchParams.mode as string | undefined;
  const q = searchParams.q?.trim();

  const where: Record<string, unknown> = {};
  if (modeFilter) where.mode = modeFilter;
  if (q) {
    where.OR = [
      { item: { sku: { contains: q, mode: "insensitive" } } },
      { item: { name: { contains: q, mode: "insensitive" } } },
      { employee: { empId: { contains: q, mode: "insensitive" } } },
      { employee: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [records, total, totalQtyAgg, newModeCount, historicalModeCount] = await Promise.all([
    db.distributionRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        item: { select: { sku: true, name: true, category: true } },
        employee: { select: { empId: true, name: true, department: true } },
        importJob: { select: { filename: true, id: true } },
        event: { select: { name: true } },
      },
    }),
    db.distributionRecord.count({ where }),
    db.distributionRecord.aggregate({
      where,
      _sum: { quantity: true },
    }),
    db.distributionRecord.count({ where: { mode: "NEW" } }),
    db.distributionRecord.count({ where: { mode: "HISTORICAL" } }),
  ]);

  const totalQuantity = Number(totalQtyAgg._sum.quantity || 0);
  const pages = Math.ceil(total / pageSize);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader
        title="Distribution Ledger"
        description="Immutable audit trail of all items distributed to employees across events and standard requests."
        breadcrumbs={[
          { label: "Operations" },
          { label: "Distribution Ledger" },
        ]}
        actions={
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/events" className="btn secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Gift size={15} /> Distribute Goodies
            </Link>
            <Link href="/reports?tab=ledger" className="btn secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <FileSpreadsheet size={15} /> Export Ledger
            </Link>
          </div>
        }
      />

      {/* KPI Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <KpiCard
          label="Total Distributions"
          value={total.toLocaleString()}
          subtext="Recorded transactions"
          icon={<ClipboardList size={18} />}
        />
        <KpiCard
          label="Total Units Distributed"
          value={totalQuantity.toLocaleString()}
          subtext="Items issued to staff"
          icon={<Package size={18} />}
        />
        <KpiCard
          label="Live Distributions"
          value={newModeCount.toLocaleString()}
          subtext="Goodies & approved requisitions"
          icon={<Gift size={18} />}
        />
        <KpiCard
          label="Historical Imports"
          value={historicalModeCount.toLocaleString()}
          subtext="Legacy provenance records"
          icon={<Layers size={18} />}
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
            <Search size={14} /> Search Recipient or Item
          </label>
          <input 
            id="q" 
            name="q" 
            defaultValue={q} 
            placeholder="Search by SKU, item name, employee ID or name…" 
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ flex: "0 1 180px" }}>
          <label htmlFor="mode" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 6 }}>
            <Filter size={14} /> Distribution Mode
          </label>
          <select id="mode" name="mode" defaultValue={modeFilter ?? ""} style={{ width: "100%" }}>
            <option value="">All modes</option>
            <option value="NEW">Live (Event & Request)</option>
            <option value="HISTORICAL">Historical (Imported)</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Filter size={14} /> Apply Filter
          </button>
          {(q || modeFilter) && (
            <Link href="/distribution" className="btn secondary">
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* Ledger Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
            Ledger Entries ({total.toLocaleString()} total)
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
                <th>Employee</th>
                <th>Item & SKU</th>
                <th className="numeric">Quantity</th>
                <th>Context / Event</th>
                <th>Source Origin</th>
                <th>Movement Ref</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500 }}>
                      <Calendar size={13} style={{ color: "var(--foreground-subtle)" }} />
                      {r.distributionDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--foreground-subtle)", marginTop: 2 }}>
                      Logged {r.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={r.mode === "HISTORICAL" ? "HISTORICAL" : "APPROVED"} />
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div 
                        style={{ 
                          width: 28, 
                          height: 28, 
                          borderRadius: "50%", 
                          background: "var(--primary-subtle)", 
                          color: "var(--primary)", 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700 
                        }}
                      >
                        {r.employee.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                          {r.employee.name}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--foreground-subtle)" }}>
                          <code style={{ fontSize: 10 }}>{r.employee.empId}</code> {r.employee.department ? `· ${r.employee.department}` : ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>
                      <Link 
                        href={`/inventory/${r.itemId}`} 
                        style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}
                      >
                        {r.item.name}
                      </Link>
                      <div style={{ fontSize: 11, color: "var(--foreground-subtle)", marginTop: 2 }}>
                        <code style={{ fontSize: 10 }}>{r.item.sku}</code> {r.item.category ? `· ${r.item.category}` : ""}
                      </div>
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
                        background: "rgba(239, 68, 68, 0.08)",
                        color: "var(--danger)"
                      }}
                    >
                      -{String(r.quantity)}
                    </span>
                  </td>
                  <td>
                    {r.event?.name ? (
                      <span 
                        style={{ 
                          display: "inline-flex", 
                          alignItems: "center", 
                          gap: 5, 
                          padding: "2px 8px", 
                          borderRadius: 4, 
                          background: "var(--primary-subtle)", 
                          color: "var(--primary)", 
                          fontSize: 12, 
                          fontWeight: 600 
                        }}
                      >
                        <Gift size={12} /> {r.event.name} {r.recipientType ? `(${r.recipientType})` : ""}
                      </span>
                    ) : r.category ? (
                      <span style={{ fontSize: 12, color: "var(--foreground-muted)" }}>
                        {r.category}
                      </span>
                    ) : (
                      <span style={{ color: "var(--foreground-subtle)" }}>—</span>
                    )}
                  </td>
                  <td>
                    {r.importJob ? (
                      <Link 
                        href={`/imports/${r.importJob.id}`} 
                        style={{ 
                          display: "inline-flex", 
                          alignItems: "center", 
                          gap: 4, 
                          fontSize: 12, 
                          color: "var(--primary)", 
                          textDecoration: "none" 
                        }}
                      >
                        <FileSpreadsheet size={13} /> {r.importJob.filename}
                      </Link>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--foreground-muted)" }}>Direct Distribution</span>
                    )}
                    {r.sourceRow && (
                      <div style={{ fontSize: 10, color: "var(--foreground-subtle)" }}>
                        Row #{r.sourceRow}
                      </div>
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
            icon={<ClipboardList size={32} />}
            title="No distribution records found"
            description={
              q || modeFilter
                ? "No transactions match your search filter criteria. Try resetting the filters."
                : "No distribution records have been recorded yet. Distribute goodies or import recipient files."
            }
            action={
              (q || modeFilter) ? (
                <Link href="/distribution" className="btn secondary">
                  Reset Filters
                </Link>
              ) : (
                <Link href="/events" className="btn primary">
                  Distribute Goodies
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
                  href={`/distribution?page=${page - 1}${modeFilter ? `&mode=${modeFilter}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className="btn secondary"
                >
                  ← Previous
                </Link>
              )}
              {page < pages && (
                <Link
                  href={`/distribution?page=${page + 1}${modeFilter ? `&mode=${modeFilter}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
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

