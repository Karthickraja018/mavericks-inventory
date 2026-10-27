import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { resolveNeedsReview } from "../../../../actions";
export const dynamic = "force-dynamic";

// -------------------------------------------------------------------------
// NEEDS_REVIEW resolution page
// Blocked decisions per OQ-27: reviewer role assignment, permitted outcomes
// beyond requeue-to-PENDING_MANAGER (e.g. close without fulfilling).
// This page implements only the safe requeue action confirmed by existing code:
//   - Re-submitting puts the request back to PENDING_MANAGER.
//   - Rejecting closes it with REJECTED status.
// Neither action deducts stock.
// -------------------------------------------------------------------------

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  // OQ-27: reviewer role is unconfirmed. Allow MANAGER/AUTHORITY for now;
  // restrict further when OQ-27 is resolved.
  const u = await requireUser(["MANAGER", "AUTHORITY"]);

  const request = await db.request.findUnique({
    where: { id: params.id, status: "NEEDS_REVIEW" },
    include: {
      requester: { select: { name: true } },
      lines: { include: { item: { select: { sku: true, name: true, quantity: true } } } },
      approvals: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!request) {
    return (
      <>
        <h1>Request not found or not in NEEDS_REVIEW</h1>
        <p>
          This request may have already been resolved, or you do not have access to it.
        </p>
      </>
    );
  }

  // Self-review guard (consistent with existing self-approval guard)
  const isSelf = request.requesterId === u.id;

  return (
    <>
      <PageHeader
        title={`Review: REQ-${String(request.number).padStart(5, "0")}`}
        description="This request requires review before it can proceed or be closed."
      />

      {searchParams.error && <div className="err">{searchParams.error}</div>}

      {/* Review reason */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Review reason</h2>
        <p style={{ color: "var(--danger)", fontWeight: 500 }}>
          {request.reviewReason ?? "No reason recorded."}
        </p>
        <small>
          Requested by <b>{request.requester.name}</b> ·{" "}
          {request.submittedAt
            ? `Submitted ${request.submittedAt.toLocaleDateString("en-GB")}`
            : "Not yet submitted"}
        </small>
      </div>

      {/* Request lines with current stock */}
      <h2>Requested items and current stock</h2>
      <div className="card scroll" style={{ marginBottom: 16 }}>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Item</th>
              <th className="numeric">Requested</th>
              <th className="numeric">In stock now</th>
              <th>Shortfall</th>
            </tr>
          </thead>
          <tbody>
            {request.lines.map((l) => {
              const short = Number(l.quantity) - Number(l.item.quantity);
              return (
                <tr key={l.id}>
                  <td>
                    <code style={{ fontSize: 11 }}>{l.item.sku}</code>
                  </td>
                  <td>{l.itemName}</td>
                  <td className="numeric">{String(l.quantity)}</td>
                  <td
                    className="numeric"
                    style={l.item.quantity.lt(l.quantity) ? { color: "var(--danger)", fontWeight: 600 } : undefined}
                  >
                    {String(l.item.quantity)}
                  </td>
                  <td>
                    {short > 0 ? (
                      <span style={{ color: "var(--danger)", fontWeight: 600 }}>−{short}</span>
                    ) : (
                      <span style={{ color: "var(--success)" }}>✓ in stock</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Previous approval history */}
      {request.approvals.length > 0 && (
        <>
          <h2>Approval history</h2>
          <div className="card scroll" style={{ marginBottom: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Approver</th>
                  <th>Decision</th>
                  <th>Remarks</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {request.approvals.map((a) => (
                  <tr key={a.id}>
                    <td>Stage {a.stage}</td>
                    <td>{a.approverName}</td>
                    <td>
                      <span className={`badge ${a.decision}`}>{a.decision.toLowerCase()}</span>
                    </td>
                    <td>
                      <small style={{ color: "var(--muted)" }}>{a.remarks || "—"}</small>
                    </td>
                    <td>
                      <small>{a.createdAt.toLocaleDateString("en-GB")}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Resolution actions */}
      {isSelf ? (
        <div className="card" style={{ background: "var(--warning-soft)", borderColor: "#fedf89" }}>
          <b>Cannot resolve your own request.</b>
          <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
            Another authorized reviewer must handle this request.
          </p>
        </div>
      ) : (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Resolve this review</h2>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            <b>Requeue</b> — sends the request back to Stage 1 approval (PENDING_MANAGER).
            No stock is deducted by this action. Stock will be checked again at final approval.
            <br />
            <b>Reject</b> — permanently closes the request. No stock is deducted.
            <br />
            <br />
            Note: The reviewer assignment rules and additional resolution outcomes are pending
            business confirmation (OQ-27).
          </p>
          <form action={resolveNeedsReview}>
            <input type="hidden" name="id" value={request.id} />
            <div className="row" style={{ marginTop: 12 }}>
              <div>
                <label htmlFor={`remarks-${request.id}`}>Remarks (required to reject)</label>
                <input id={`remarks-${request.id}`} name="remarks" placeholder="Reason for decision…" />
              </div>
              <button name="decision" value="reject" className="danger">
                Reject
              </button>
              <button name="decision" value="requeue">
                Requeue to Stage 1
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
