import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { decide } from "../../actions";
import { approveImportStock } from "../imports/actions";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { StockIndicator } from "@/components/ui/stock-indicator";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckCircle2, ShieldCheck, AlertCircle, FileSpreadsheet } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const u = await requireUser(["ADMIN", "MANAGER", "AUTHORITY"]);

  const requestStatusFilter =
    u.role === "MANAGER"
      ? "PENDING_MANAGER"
      : u.role === "AUTHORITY"
      ? "PENDING_AUTHORITY"
      : { in: ["PENDING_MANAGER", "PENDING_AUTHORITY"] };

  const [requests, imports] = await Promise.all([
    db.request.findMany({
      where: {
        status: requestStatusFilter as any,
        requesterId: u.role === "ADMIN" ? undefined : { not: u.id },
      },
      include: {
        requester: true,
        lines: { include: { item: true } },
      },
      orderBy: { number: "asc" },
    }),
    db.importJob.findMany({
      where: {
        status: "AWAITING_APPROVAL",
        type: { in: ["STOCK_COUNT", "PROCUREMENT"] },
        uploadedById: u.role === "ADMIN" ? undefined : { not: u.id },
      },
      include: {
        uploadedBy: true,
        rows: {
          where: { status: "VALID" },
          orderBy: { sourceRow: "asc" },
          include: { matchedItem: { select: { sku: true, name: true, quantity: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const stageLabel =
    u.role === "MANAGER"
      ? "Stage 1: Manager Review"
      : u.role === "AUTHORITY"
      ? "Stage 2: Final Authority Decision"
      : "Administrator (All Workflow Stages & System Override)";

  return (
    <>
      <PageHeader
        title="Approvals"
        description={`Authoritative review inbox for ${u.role}. Ensure items have verified stock availability and business justification before approval.`}
        breadcrumbs={[
          { label: "Governance" },
          { label: "Approvals" },
        ]}
        badge={<StatusBadge status={u.role} size="md" />}
      />

      {searchParams.error && <div className="err">{searchParams.error}</div>}
      {searchParams.success && <div className="ok">{searchParams.success}</div>}

      {/* Requisition Approvals Section */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>
            Requisition Requests Awaiting Your Approval ({requests.length})
          </h2>
          <small style={{ color: "var(--muted)" }}>{stageLabel}</small>
        </div>

        {!requests.length ? (
          <div className="card" style={{ padding: 0 }}>
            <EmptyState
              icon={CheckCircle2}
              title="All caught up!"
              description={`There are currently no distribution requests awaiting ${u.role.toLowerCase()} approval.`}
            />
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {requests.map((r) => {
              const totalUnits = r.lines.reduce((s, l) => s + Number(l.quantity), 0);
              const hasDeficit = r.lines.some((l) => l.item.quantity.lt(l.quantity));

              return (
                <form action={decide} className="card" key={r.id} style={{ margin: 0, padding: 20 }}>
                  <input type="hidden" name="id" value={r.id} />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Link href={`/requests/${r.id}`}>
                          <code style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
                            REQ-{String(r.number).padStart(5, "0")}
                          </code>
                        </Link>
                        <span style={{ fontSize: 13, color: "var(--muted)" }}>
                          from <strong>{r.requester.name}</strong>
                        </span>
                        <StatusBadge status={r.status} size="sm" />
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>
                        <strong>Purpose:</strong> {r.purpose || "No justification provided"}
                      </p>
                    </div>

                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      Submitted: {r.createdAt.toLocaleDateString("en-GB")} · <strong>{totalUnits} units</strong>
                    </div>
                  </div>

                  {hasDeficit && (
                    <div
                      className="err"
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        marginBottom: 12,
                        background: "#fff1f2",
                        borderColor: "#fecdd3",
                        color: "#9f1239",
                      }}
                    >
                      ⚠ One or more items exceed current stock on hand. Approving will trigger <em>NEEDS_REVIEW</em> status if stock remains unavailable.
                    </div>
                  )}

                  <div className="card scroll" style={{ padding: 0, marginBottom: 14, background: "var(--surface-subtle)" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th className="numeric">Requested</th>
                          <th className="numeric">Stock on Hand</th>
                          <th>Stock Feasibility</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.lines.map((l) => {
                          const req = Number(l.quantity);
                          const onHand = Number(l.item.quantity);
                          const ok = onHand >= req;

                          return (
                            <tr key={l.id}>
                              <td>
                                <code>{l.item.sku}</code> · <strong>{l.itemName}</strong>
                              </td>
                              <td className="numeric" style={{ fontWeight: 700 }}>
                                {req} {l.item.unit}
                              </td>
                              <td className="numeric">
                                <StockIndicator quantity={onHand} unit={l.item.unit} />
                              </td>
                              <td>
                                {ok ? (
                                  <span className="badge APPROVED" style={{ fontSize: 10.5 }}>✓ In stock</span>
                                ) : (
                                  <span className="badge REJECTED" style={{ fontSize: 10.5 }}>⚠ Deficit</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                      paddingTop: 10,
                      borderTop: "1px solid var(--line)",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <label htmlFor={`r${r.id}`} style={{ fontSize: 11.5 }}>
                        Reviewer Remarks (Required if rejecting)
                      </label>
                      <input
                        id={`r${r.id}`}
                        name="remarks"
                        placeholder="Provide reason for approval or specific rejection feedback…"
                        style={{ minHeight: 34, fontSize: 12.5 }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button name="decision" value="reject" className="danger" type="submit" style={{ minHeight: 34 }}>
                        Reject
                      </button>
                      <button name="decision" value="approve" type="submit" style={{ minHeight: 34 }}>
                        Approve Stage →
                      </button>
                    </div>
                  </div>
                </form>
              );
            })}
          </div>
        )}
      </div>

      {/* Staged Import Approvals Section */}
      {imports.length > 0 && (
        <div>
          <h2 style={{ margin: "0 0 14px", fontSize: 16 }}>
            Staged Import Approvals ({imports.length})
          </h2>
          <div style={{ display: "grid", gap: 16 }}>
            {imports.map((job) => {
              const isStockCount = job.type === "STOCK_COUNT";
              const rows = job.rows.map((row) => {
                const raw = row.raw as Record<string, unknown>;
                const before = Number(row.matchedItem?.quantity ?? 0);
                const target = Number(raw.Available ?? 0);
                return { row, before, target, variance: target - before };
              });
              const changed = rows.filter((entry) => entry.variance !== 0);
              const increase = changed.filter((entry) => entry.variance > 0).reduce((sum, entry) => sum + entry.variance, 0);
              const decrease = changed.filter((entry) => entry.variance < 0).reduce((sum, entry) => sum + Math.abs(entry.variance), 0);

              return (
                <form action={approveImportStock} className="card" key={job.id} style={{ margin: 0, padding: 20 }}>
                  <input type="hidden" name="id" value={job.id} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                    <div>
                      <strong style={{ fontSize: 14 }}>
                        {job.type.replace(/_/g, " ")} / {job.mode}
                      </strong>
                      <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>
                        File: <code>{job.filename}</code> · Uploaded by <strong>{job.uploadedBy.name}</strong>
                      </span>
                    </div>
                    <StatusBadge status={job.status} size="sm" />
                  </div>

                  {isStockCount ? (
                    <>
                      <div className="grid" style={{ marginBottom: 14 }}>
                        <div style={{ padding: "8px 12px", background: "var(--surface-subtle)", borderRadius: 6 }}>
                          <small style={{ color: "var(--muted)" }}>Rows Audited</small>
                          <div className="big" style={{ fontSize: 20 }}>{rows.length}</div>
                        </div>
                        <div style={{ padding: "8px 12px", background: "var(--surface-subtle)", borderRadius: 6 }}>
                          <small style={{ color: "var(--muted)" }}>Discrepancies</small>
                          <div className="big" style={{ fontSize: 20 }}>{changed.length}</div>
                        </div>
                        <div style={{ padding: "8px 12px", background: "var(--surface-subtle)", borderRadius: 6 }}>
                          <small style={{ color: "var(--muted)" }}>Net Stock In</small>
                          <div className="big" style={{ fontSize: 20, color: "var(--success)" }}>+{increase}</div>
                        </div>
                        <div style={{ padding: "8px 12px", background: "var(--surface-subtle)", borderRadius: 6 }}>
                          <small style={{ color: "var(--muted)" }}>Net Stock Deducted</small>
                          <div className="big" style={{ fontSize: 20, color: "var(--danger)" }}>-{decrease}</div>
                        </div>
                      </div>

                      <div className="card scroll" style={{ padding: 0, maxHeight: 300, overflowY: "auto", marginBottom: 14 }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Row</th>
                              <th>Item</th>
                              <th className="numeric">Balance Before</th>
                              <th className="numeric">Counted Target</th>
                              <th className="numeric">Variance Adjustment</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(({ row, before, target, variance }) => (
                              <tr key={row.id}>
                                <td><small>{row.sourceRow}</small></td>
                                <td>
                                  <code>{row.matchedItem?.sku}</code> · {row.matchedItem?.name}
                                </td>
                                <td className="numeric">{before}</td>
                                <td className="numeric">{target}</td>
                                <td
                                  className="numeric"
                                  style={{
                                    fontWeight: 700,
                                    color: variance > 0 ? "var(--success)" : variance < 0 ? "var(--danger)" : "var(--muted)",
                                  }}
                                >
                                  {variance > 0 ? `+${variance}` : variance}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>
                      Review staged procurement records. Approving will safely post incoming stock adjustments to the ledger.
                    </p>
                  )}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                      paddingTop: 10,
                      borderTop: "1px solid var(--line)",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <label htmlFor={`i${job.id}`} style={{ fontSize: 11.5 }}>
                        Approval Justification / Reconciliation Audit Note
                      </label>
                      <input
                        id={`i${job.id}`}
                        name="reason"
                        placeholder="State reason for approving reconciliation stock adjustments…"
                        style={{ minHeight: 34, fontSize: 12.5 }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button name="decision" value="reject" className="danger" type="submit" style={{ minHeight: 34 }}>
                        Reject Import
                      </button>
                      <button name="decision" value="approve" type="submit" style={{ minHeight: 34 }}>
                        Approve & Post Stock Movement
                      </button>
                    </div>
                  </div>
                </form>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
