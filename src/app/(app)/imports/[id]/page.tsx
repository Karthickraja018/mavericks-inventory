import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { prepareImport, commitImport } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Layers, 
  ArrowRight, 
  Download, 
  UserCheck, 
  AlertCircle,
  FileCheck
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ImportDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  await requireUser(["ADMIN"]);
  const j = await db.importJob.findUnique({ where: { id: params.id } });
  if (!j) notFound();

  const bad = await db.importRow.findMany({
    where: { jobId: j.id, status: "INVALID" },
    orderBy: { sourceRow: "asc" },
    take: 200,
  });
  const rows = await db.importRow.findMany({
    where: { jobId: j.id },
    orderBy: { sourceRow: "asc" },
    take: 200,
    include: { matchedItem: true, matchedEmployee: true },
  });

  // For Stock Count: calculate per-row variance vs current balance
  const reconRows =
    j.type === "STOCK_COUNT" && (j.status === "AWAITING_APPROVAL" || j.status === "COMMITTED" || j.status === "VALIDATED")
      ? await db.reconciliationReview.findMany({
          where: { importJobId: j.id },
          include: { item: { select: { sku: true, name: true, quantity: true } } },
          orderBy: { sourceRow: "asc" },
        })
      : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader
        title={j.filename}
        description={`${j.type.replace(/_/g, " ")} · ${j.mode.toLowerCase()} mode · Uploaded on ${j.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`}
        breadcrumbs={[
          { label: "Import Center", href: "/imports" },
          { label: j.filename },
        ]}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatusBadge status={j.status} />
          </div>
        }
      />

      {searchParams.error && (
        <div 
          style={{ 
            padding: "12px 16px", 
            borderRadius: 6, 
            background: "rgba(239, 68, 68, 0.08)", 
            border: "1px solid rgba(239, 68, 68, 0.2)", 
            color: "var(--danger)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <AlertCircle size={16} />
          <span>{searchParams.error}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <KpiCard
          label="Total Rows"
          value={j.totalRows.toLocaleString()}
          subtext="Rows in workbook"
          icon={<FileSpreadsheet size={18} />}
        />
        <KpiCard
          label="Valid Rows"
          value={j.validRows.toLocaleString()}
          subtext="Schema validated"
          variant={j.validRows === j.totalRows ? "success" : "default"}
          icon={<CheckCircle2 size={18} />}
        />
        <KpiCard
          label="Rows with Errors"
          value={j.invalidRows.toLocaleString()}
          subtext="Validation failures"
          variant={j.invalidRows > 0 ? "danger" : "default"}
          icon={<AlertTriangle size={18} />}
        />
        {j.duplicateRows > 0 && (
          <KpiCard
            label="Duplicate Rows"
            value={j.duplicateRows.toLocaleString()}
            subtext="Identical key detected"
            variant="warning"
            icon={<AlertCircle size={18} />}
          />
        )}
      </div>

      {j.errorSummary && (
        <div 
          style={{ 
            padding: "12px 16px", 
            borderRadius: 6, 
            background: "rgba(239, 68, 68, 0.08)", 
            border: "1px solid rgba(239, 68, 68, 0.2)", 
            color: "var(--danger)",
            fontSize: 13
          }}
        >
          <strong>Error Summary:</strong> {j.errorSummary}
        </div>
      )}

      {/* Stage Actions & Notices */}
      {j.status === "VALIDATED" && (
        <div className="card" style={{ padding: 18, background: "var(--surface)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
              Step 2 Completed: Workbook Validated
            </div>
            <div style={{ fontSize: 13, color: "var(--foreground-muted)", marginTop: 2 }}>
              Structure conforms to specification. Match products and employees to generate discrepancy review.
            </div>
          </div>
          <form action={prepareImport}>
            <input type="hidden" name="id" value={j.id} />
            <button type="submit" className="btn primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <FileCheck size={16} /> Match Products & Generate Preview
            </button>
          </form>
        </div>
      )}

      {j.status === "AWAITING_APPROVAL" && (
        <div 
          className="card" 
          style={{ 
            padding: 18, 
            background: "rgba(245, 158, 11, 0.08)", 
            border: "1px solid rgba(245, 158, 11, 0.3)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--warning)", display: "flex", alignItems: "center", gap: 6 }}>
              <Clock size={16} /> Two-Stage Authorization Required
            </div>
            <div style={{ fontSize: 13, color: "var(--foreground)", marginTop: 4 }}>
              This import has been staged and requires approval before stock movements can be posted.
            </div>
          </div>
          <Link href="/approvals" className="btn primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            Go to Approvals Queue <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {j.status === "COMMITTED" && (
        <div 
          className="card" 
          style={{ 
            padding: 16, 
            background: "rgba(16, 185, 129, 0.08)", 
            border: "1px solid rgba(16, 185, 129, 0.25)",
            color: "var(--success)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            fontWeight: 500
          }}
        >
          <CheckCircle2 size={18} />
          <span>Committed at {j.committedAt?.toISOString().replace("T", " ").slice(0, 19)} UTC. Transactions posted to authoritative ledger.</span>
        </div>
      )}

      {/* Commit action for historical modes or staged recipient */}
      {((j.status === "VALIDATED" && j.mode === "HISTORICAL") ||
        (j.status === "AWAITING_APPROVAL" && j.type === "RECIPIENT" && j.mode === "NEW")) && (
        <div className="card" style={{ padding: 18, background: "var(--surface)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
              {j.mode === "NEW" ? "Confirm Distribution Staging" : "Commit Historical Provenance Records"}
            </div>
            <div style={{ fontSize: 13, color: "var(--foreground-muted)", marginTop: 2 }}>
              {j.mode === "HISTORICAL" ? "Historical records preserve audit provenance without mutating live stock balances." : "Generates pending distribution requests requiring line-item review."}
            </div>
          </div>
          <form action={commitImport}>
            <input type="hidden" name="id" value={j.id} />
            <button type="submit" className="btn primary">
              {j.mode === "NEW" ? "Create Pending Distribution Requests" : "Commit Historical Records"}
            </button>
          </form>
        </div>
      )}

      {/* Stock Count reconciliation preview */}
      {j.type === "STOCK_COUNT" && reconRows.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Stock Reconciliation Preview</h3>
          </div>
          <div className="table-container" style={{ margin: 0, border: "none" }}>
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Item & SKU</th>
                  <th className="numeric">Current Balance</th>
                  <th className="numeric">Counted (Target)</th>
                  <th className="numeric">Variance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reconRows.map((r) => {
                  const variance = Number(r.variance);
                  return (
                    <tr key={r.id}>
                      <td><code style={{ fontSize: 11 }}>#{r.sourceRow}</code></td>
                      <td>
                        <Link href={`/inventory/${r.itemId}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}>
                          {r.item.name}
                        </Link>
                        <div style={{ fontSize: 11, color: "var(--foreground-subtle)" }}>
                          <code>{r.item.sku}</code>
                        </div>
                      </td>
                      <td className="numeric" style={{ color: "var(--foreground-muted)" }}>{String(r.balanceBefore)}</td>
                      <td className="numeric" style={{ fontWeight: 600 }}>{String(r.targetBalance)}</td>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Matched row preview (post-prepare) */}
      {j.status === "VALIDATED" && rows.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Staged Row Entity Resolution ({rows.length} rows)</h3>
          </div>
          <div className="table-container" style={{ margin: 0, border: "none" }}>
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Resolved Item Variant</th>
                  {j.type === "RECIPIENT" && <th>Employee Recipient</th>}
                  <th>Match Validation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><code style={{ fontSize: 11 }}>#{row.sourceRow}</code></td>
                    <td>
                      {row.matchedItem ? (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                            {row.matchedItem.name}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--foreground-subtle)" }}>
                            <code>{row.matchedItem.sku}</code>
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "var(--danger)", fontSize: 12 }}>Unmatched item variant</span>
                      )}
                    </td>
                    {j.type === "RECIPIENT" && (
                      <td>
                        {row.matchedEmployee ? (
                          <div style={{ fontSize: 12, fontWeight: 500 }}>
                            {row.matchedEmployee.name} <code style={{ fontSize: 11 }}>({row.matchedEmployee.empId})</code>
                          </div>
                        ) : (
                          <span style={{ color: "var(--foreground-subtle)", fontSize: 12 }}>—</span>
                        )}
                      </td>
                    )}
                    <td>
                      <StatusBadge status={row.status === "VALID" ? "APPROVED" : "REJECTED"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rows with errors */}
      {bad.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--danger)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={16} /> Validation Errors ({bad.length} rows)
            </h3>
            <Link href={`/imports/${j.id}/errors`} className="btn secondary" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Download size={13} /> Download Error CSV
            </Link>
          </div>
          <div className="table-container" style={{ margin: 0, border: "none" }}>
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Field Column</th>
                  <th>Error Code</th>
                  <th>Specification Failure</th>
                </tr>
              </thead>
              <tbody>
                {bad.flatMap((r) =>
                  (r.errors as any[]).map((e, i) => (
                    <tr key={r.id + i}>
                      <td><code style={{ fontSize: 11 }}>#{r.sourceRow}</code></td>
                      <td><code style={{ fontSize: 11 }}>{e.field}</code></td>
                      <td><code style={{ fontSize: 11, color: "var(--danger)" }}>{e.code}</code></td>
                      <td><span style={{ fontSize: 12, color: "var(--foreground)" }}>{e.message}</span></td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

