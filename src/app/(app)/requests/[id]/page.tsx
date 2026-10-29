import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { submitRequest, decide } from "../../../actions";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { StockIndicator } from "@/components/ui/stock-indicator";
import { ArrowLeft, CheckCircle2, Clock, XCircle, AlertTriangle, User, Calendar, FileText, Gift, Users, Award } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const u = await requireUser();

  const [r, distributions] = await Promise.all([
    db.request.findUnique({
      where: { id: params.id },
      include: {
        lines: {
          include: {
            item: { select: { sku: true, name: true, quantity: true, unit: true } },
          },
        },
        approvals: { orderBy: { stage: "asc" } },
        requester: true,
        event: true,
      },
    }),
    db.distributionRecord.findMany({
      where: { sourceRef: params.id },
      include: {
        employee: true,
        item: { select: { sku: true, name: true, unit: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!r || (u.role === "EXECUTIVE" && r.requesterId !== u.id)) {
    notFound();
  }

  const reqNumber = `REQ-${String(r.number).padStart(5, "0")}`;

  // Check if current user is the pending approver
  const isManagerPending = r.status === "PENDING_MANAGER" && u.role === "MANAGER" && r.requesterId !== u.id;
  const isAuthorityPending = r.status === "PENDING_AUTHORITY" && u.role === "AUTHORITY" && r.requesterId !== u.id;
  const canDecide = isManagerPending || isAuthorityPending;

  const totalUnits = r.lines.reduce((s, l) => s + Number(l.quantity), 0);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <PageHeader
        title={reqNumber}
        description={`Distribution requisition submitted by ${r.requester.name} on ${r.createdAt.toLocaleDateString("en-GB")}.`}
        badge={<StatusBadge status={r.status} size="md" />}
        breadcrumbs={[
          { label: "Workspace", href: "/" },
          { label: "Distribution Requests", href: "/requests" },
          { label: reqNumber },
        ]}
        actions={
          <Link href="/requests">
            <button className="ghost" style={{ minHeight: 34, fontSize: 13 }}>
              <ArrowLeft size={14} /> Back to Requests
            </button>
          </Link>
        }
      />

      {/* Needs Review Alert Banner */}
      {r.status === "NEEDS_REVIEW" && (
        <div
          className="err"
          style={{
            marginBottom: 20,
            background: "#fff1f2",
            borderColor: "#fecdd3",
            color: "#9f1239",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <strong>Needs Review — Stock Allocation Exception</strong>
            <p style={{ margin: "4px 0 0", fontSize: 12.5 }}>
              {r.reviewReason || "One or more line items had insufficient stock at time of final approval."}
            </p>
          </div>
          {(u.role === "MANAGER" || u.role === "AUTHORITY") && (
            <Link href={`/requests/${r.id}/review`}>
              <button className="danger" style={{ minHeight: 32, fontSize: 12.5 }}>
                Resolve Review →
              </button>
            </Link>
          )}
        </div>
      )}

      {/* Overview Metadata Card */}
      <div className="card" style={{ marginBottom: 20, padding: 20 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>Requisition Details</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <div>
            <span style={{ fontSize: 11.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <User size={13} /> Requester
            </span>
            <strong style={{ fontSize: 14, color: "var(--ink)", display: "block", marginTop: 2 }}>
              {r.requester.name}
            </strong>
            <small style={{ color: "var(--muted)" }}>{r.requester.role.toLowerCase()}</small>
          </div>
          <div>
            <span style={{ fontSize: 11.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={13} /> Submitted Date
            </span>
            <strong style={{ fontSize: 14, color: "var(--ink)", display: "block", marginTop: 2 }}>
              {r.submittedAt ? r.submittedAt.toLocaleDateString("en-GB") : "Draft (Not submitted)"}
            </strong>
          </div>
          <div>
            <span style={{ fontSize: 11.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <FileText size={13} /> Approval Stages
            </span>
            <strong style={{ fontSize: 14, color: "var(--ink)", display: "block", marginTop: 2 }}>
              {r.levels === 1 ? "1 Stage (Manager)" : "2 Stages (Manager & Authority)"}
            </strong>
          </div>
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
          <span style={{ fontSize: 11.5, color: "var(--muted)", display: "block", marginBottom: 4 }}>
            Business Purpose / Justification:
          </span>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.5 }}>
            {r.purpose || <span style={{ color: "var(--faint)" }}>No purpose was provided.</span>}
          </p>
        </div>
      </div>

      {/* Linked Event Card */}
      {r.event && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            padding: 16,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 8,
                background: "var(--accent-soft)",
                color: "var(--accent-dark)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Gift size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link href={`/events/${r.event.id}`}>
                  <strong style={{ fontSize: 15, color: "var(--accent)" }}>{r.event.name}</strong>
                </Link>
                <StatusBadge status={r.event.status} size="sm" />
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Category: <strong>{r.event.category}</strong> · Date:{" "}
                {r.event.date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                {r.event.location ? ` · Location: ${r.event.location}` : ""}
              </div>
            </div>
          </div>

          <Link href={`/events/${r.event.id}`}>
            <button className="ghost" style={{ fontSize: 12.5, minHeight: 34 }}>
              Open Event Dashboard →
            </button>
          </Link>
        </div>
      )}

      {/* Requested Line Items Table */}
      <div className="card scroll" style={{ padding: 0, marginBottom: 20 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Aggregated Line Items ({r.lines.length})</h3>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Total Units: {totalUnits}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Item Variant</th>
              <th className="numeric">Requested Qty</th>
              <th className="numeric">Current Available Stock</th>
              <th>Stock Feasibility</th>
            </tr>
          </thead>
          <tbody>
            {r.lines.map((l) => {
              const inStock = Number(l.item.quantity);
              const requested = Number(l.quantity);
              const isFeasible = inStock >= requested;

              return (
                <tr key={l.id}>
                  <td>
                    <code>{l.item.sku}</code>
                  </td>
                  <td>
                    <strong>{l.itemName}</strong>
                  </td>
                  <td className="numeric" style={{ fontWeight: 700 }}>
                    {requested} {l.item.unit}
                  </td>
                  <td className="numeric">
                    <StockIndicator quantity={inStock} unit={l.item.unit} />
                  </td>
                  <td>
                    {isFeasible ? (
                      <span className="badge APPROVED" style={{ fontSize: 11 }}>
                        ✓ Available
                      </span>
                    ) : (
                      <span className="badge REJECTED" style={{ fontSize: 11 }}>
                        ⚠ Deficit: {requested - inStock} {l.item.unit}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Recipient Employees Allocation Table (if linked distribution records exist) */}
      {distributions.length > 0 && (
        <div className="card scroll" style={{ padding: 0, marginBottom: 20 }}>
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={16} style={{ color: "var(--accent)" }} />
              <h3 style={{ margin: 0, fontSize: 14 }}>
                Recipient Employees & Allocated Goodies ({distributions.length})
              </h3>
            </div>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {new Set(distributions.map((d) => d.employeeId)).size} unique employees
            </span>
          </div>

          <table>
            <thead>
              <tr>
                <th style={{ width: 140 }}>Emp ID</th>
                <th>Employee Name</th>
                <th style={{ width: 140 }}>Recognition Role</th>
                <th>Goodie Assigned</th>
                <th className="numeric" style={{ width: 80 }}>Qty</th>
                <th style={{ width: 140 }}>Allocation Status</th>
                <th style={{ textAlign: "right", width: 100 }}>Profile</th>
              </tr>
            </thead>
            <tbody>
              {distributions.map((dist) => (
                <tr key={dist.id}>
                  <td>
                    <code>{dist.employee.empId}</code>
                  </td>
                  <td>
                    <strong style={{ fontSize: 13 }}>{dist.employee.name}</strong>
                    <small style={{ color: "var(--muted)", display: "block" }}>
                      {dist.employee.baseLocation} {dist.employee.department ? `· ${dist.employee.department}` : ""}
                    </small>
                  </td>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 7px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 650,
                        background:
                          dist.recipientType === "WINNER"
                            ? "rgba(245, 158, 11, 0.15)"
                            : dist.recipientType === "RUNNER_UP"
                            ? "rgba(59, 130, 246, 0.15)"
                            : "var(--surface-subtle)",
                        color:
                          dist.recipientType === "WINNER"
                            ? "#d97706"
                            : dist.recipientType === "RUNNER_UP"
                            ? "#2563eb"
                            : "var(--foreground-muted)",
                      }}
                    >
                      {(dist.recipientType || "PARTICIPANT").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td>
                    <div>
                      <strong style={{ fontSize: 12.5 }}>{dist.item.name}</strong>
                      <small style={{ color: "var(--muted)", display: "block" }}>
                        <code>{dist.item.sku}</code>
                      </small>
                    </div>
                  </td>
                  <td className="numeric" style={{ fontWeight: 700 }}>
                    {Number(dist.quantity)}
                  </td>
                  <td>
                    <StatusBadge status={dist.status} size="sm" />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link href={`/employees/${dist.employee.id}`}>
                      <button className="ghost" style={{ fontSize: 11, padding: "2px 8px", minHeight: 26 }}>
                        View →
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approval Timeline */}
      <div className="card" style={{ marginBottom: 20, padding: 20 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>Approval Workflow Progression</h3>
        <div style={{ display: "grid", gap: 12 }}>
          {/* Stage 1 */}
          {(() => {
            const s1 = r.approvals.find((a) => a.stage === 1);
            return (
              <div
                style={{
                  padding: 12,
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                  background: s1 ? "var(--surface)" : "var(--surface-subtle)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                {s1?.decision === "APPROVED" ? (
                  <CheckCircle2 size={18} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} />
                ) : s1?.decision === "REJECTED" ? (
                  <XCircle size={18} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }} />
                ) : (
                  <Clock size={18} style={{ color: "var(--muted)", flexShrink: 0, marginTop: 2 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <strong style={{ fontSize: 13 }}>Stage 1: Manager Review</strong>
                    {s1 ? (
                      <StatusBadge status={s1.decision} size="sm" />
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>Pending submission / decision</span>
                    )}
                  </div>
                  {s1 && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      Reviewed by <strong>{s1.approverName}</strong> on {s1.createdAt.toLocaleDateString("en-GB")}
                      {s1.remarks ? ` — "${s1.remarks}"` : ""}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Stage 2 (if 2 levels) */}
          {r.levels >= 2 &&
            (() => {
              const s2 = r.approvals.find((a) => a.stage === 2);
              return (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                    background: s2 ? "var(--surface)" : "var(--surface-subtle)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  {s2?.decision === "APPROVED" ? (
                    <CheckCircle2 size={18} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} />
                  ) : s2?.decision === "REJECTED" ? (
                    <XCircle size={18} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }} />
                  ) : (
                    <Clock size={18} style={{ color: "var(--muted)", flexShrink: 0, marginTop: 2 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <strong style={{ fontSize: 13 }}>Stage 2: Final Authority Review & Atomic Stock Deduction</strong>
                      {s2 ? (
                        <StatusBadge status={s2.decision} size="sm" />
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>Awaiting Stage 1 approval</span>
                      )}
                    </div>
                    {s2 && (
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                        Reviewed by <strong>{s2.approverName}</strong> on {s2.createdAt.toLocaleDateString("en-GB")}
                        {s2.remarks ? ` — "${s2.remarks}"` : ""}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
        </div>
      </div>

      {/* Action Footer */}
      {r.status === "DRAFT" && r.requesterId === u.id && (
        <div className="card" style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>Ready to submit?</strong>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>
              Submitting advances this request to Manager review.
            </p>
          </div>
          <form action={submitRequest}>
            <input type="hidden" name="id" value={r.id} />
            <button type="submit">Submit for Approval →</button>
          </form>
        </div>
      )}

      {/* Approver Decision Form */}
      {canDecide && (
        <div
          className="card"
          style={{
            padding: 20,
            border: "1px solid var(--accent-border)",
            background: "var(--accent-soft)",
          }}
        >
          <h3 style={{ margin: "0 0 8px", fontSize: 15, color: "var(--accent-dark)" }}>
            Review Decision Required ({u.role})
          </h3>
          <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--ink-soft)" }}>
            {isAuthorityPending
              ? "Approving this final stage will atomically deduct the requested units from on-hand inventory."
              : "Approving this stage advances the request to Stage 2 Authority review."}
          </p>
          <form action={decide} style={{ display: "grid", gap: 12 }}>
            <input type="hidden" name="id" value={r.id} />
            <div>
              <label htmlFor="remarks">Reviewer Remarks (Required if rejecting)</label>
              <input
                id="remarks"
                name="remarks"
                placeholder="e.g. Approved per Q2 regional allocation, or reason for rejection"
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button name="decision" value="reject" className="danger" type="submit">
                Reject Request
              </button>
              <button name="decision" value="approve" type="submit">
                Approve Request
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
