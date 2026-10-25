import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { prepareImport, commitImport } from "../actions";
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

  const statusLabel = (s: string) => s.replace(/_/g, " ").toLowerCase();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            {j.filename}{" "}
            <span
              className={`badge ${
                j.status === "COMMITTED"
                  ? "APPROVED"
                  : j.status === "FAILED" || j.status === "ROLLED_BACK"
                    ? "REJECTED"
                    : j.status === "AWAITING_APPROVAL"
                      ? "PENDING_MANAGER"
                      : ""
              }`}
            >
              {statusLabel(j.status)}
            </span>
          </h1>
          <p>
            {j.type.replace("_", " ")} · {j.mode.toLowerCase()} · uploaded{" "}
            {j.createdAt.toLocaleDateString("en-GB")}
          </p>
        </div>
      </div>

      {searchParams.error && <div className="err">{searchParams.error}</div>}

      {/* Summary metrics */}
      <div className="grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <small>Total rows</small>
          <div className="big">{j.totalRows}</div>
        </div>
        <div className="card">
          <small>Valid</small>
          <div className="big" style={j.validRows === j.totalRows ? { color: "var(--success)" } : undefined}>
            {j.validRows}
          </div>
        </div>
        <div className="card">
          <small>With errors</small>
          <div className="big" style={j.invalidRows > 0 ? { color: "var(--danger)" } : undefined}>
            {j.invalidRows}
          </div>
        </div>
        {j.duplicateRows > 0 && (
          <div className="card">
            <small>Duplicates</small>
            <div className="big" style={{ color: "var(--warning)" }}>
              {j.duplicateRows}
            </div>
          </div>
        )}
      </div>

      {j.errorSummary && <div className="err">{j.errorSummary}</div>}

      {/* Stage actions */}
      {j.status === "VALIDATED" && (
        <form action={prepareImport} style={{ marginBottom: 16 }}>
          <input type="hidden" name="id" value={j.id} />
          <button>Match products and prepare preview</button>
          <small style={{ marginLeft: 12 }}>
            Matches variants and employees without changing stock.
          </small>
        </form>
      )}

      {j.status === "AWAITING_APPROVAL" && (
        <div className="card" style={{ marginBottom: 16, background: "var(--warning-soft)", borderColor: "#fedf89" }}>
          <b>Awaiting approval</b>
          <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
            This import requires approval before stock can be posted. An authorized approver (MANAGER or AUTHORITY)
            must review and approve it in the{" "}
            <Link href="/approvals" style={{ color: "var(--accent)" }}>
              Approvals
            </Link>{" "}
            queue. No stock has changed.
          </p>
        </div>
      )}

      {j.status === "COMMITTED" && (
        <div className="ok" style={{ marginBottom: 16 }}>
          Committed at {j.committedAt?.toISOString().replace("T", " ").slice(0, 19)} UTC.
        </div>
      )}

      {/* Commit action for historical modes */}
      {((j.status === "VALIDATED" && j.mode === "HISTORICAL") ||
        (j.status === "AWAITING_APPROVAL" && j.type === "RECIPIENT" && j.mode === "NEW")) && (
        <form action={commitImport} style={{ marginBottom: 16 }}>
          <input type="hidden" name="id" value={j.id} />
          <button>
            {j.mode === "NEW" ? "Create pending distribution requests" : "Commit historical records"}
          </button>
          {j.mode === "HISTORICAL" && (
            <small style={{ marginLeft: 12, color: "var(--muted)" }}>
              Historical records do not change stock.
            </small>
          )}
        </form>
      )}

      {/* Stock Count reconciliation preview */}
      {j.type === "STOCK_COUNT" && reconRows.length > 0 && (
        <>
          <h2>Reconciliation preview</h2>
          <div className="card scroll" style={{ marginBottom: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Item (SKU · Name)</th>
                  <th className="numeric">Current balance</th>
                  <th className="numeric">Target (imported)</th>
                  <th className="numeric">Variance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reconRows.map((r) => (
                  <tr key={r.id}>
                    <td><small>{r.sourceRow}</small></td>
                    <td>
                      <Link href={`/inventory/${r.itemId}`} style={{ fontSize: 13 }}>
                        <code style={{ fontSize: 11 }}>{r.item.sku}</code> · {r.item.name}
                      </Link>
                    </td>
                    <td className="numeric">{String(r.balanceBefore)}</td>
                    <td className="numeric">{String(r.targetBalance)}</td>
                    <td
                      className="numeric"
                      style={{
                        fontWeight: 600,
                        color:
                          Number(r.variance) > 0
                            ? "var(--success)"
                            : Number(r.variance) < 0
                              ? "var(--danger)"
                              : undefined,
                      }}
                    >
                      {Number(r.variance) > 0 ? "+" : ""}
                      {String(r.variance)}
                    </td>
                    <td>
                      <span className={`badge ${r.status}`}>{r.status.replace(/_/g, " ").toLowerCase()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Matched row preview (post-prepare) */}
      {j.status === "VALIDATED" && rows.length > 0 && (
        <>
          <h2>Row preview</h2>
          <div className="card scroll" style={{ marginBottom: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Variant matched</th>
                  {j.type === "RECIPIENT" && <th>Employee</th>}
                  <th>Match status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><small>{row.sourceRow}</small></td>
                    <td>
                      {row.matchedItem ? (
                        <>
                          <code style={{ fontSize: 11 }}>{row.matchedItem.sku}</code> · {row.matchedItem.name}
                        </>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>Not matched</span>
                      )}
                    </td>
                    {j.type === "RECIPIENT" && (
                      <td>
                        {row.matchedEmployee ? (
                          <code style={{ fontSize: 11 }}>{row.matchedEmployee.empId}</code>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                    )}
                    <td>
                      <span className={`badge ${row.status === "VALID" ? "APPROVED" : "REJECTED"}`}>
                        {row.status.toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Rows with errors */}
      {bad.length > 0 && (
        <>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h2>Rows with errors ({bad.length})</h2>
            <Link href={`/imports/${j.id}/errors`}>
              <button className="ghost">Download error report (CSV)</button>
            </Link>
          </div>
          <div className="card scroll">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Field</th>
                  <th>Code</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {bad.flatMap((r) =>
                  (r.errors as any[]).map((e, i) => (
                    <tr key={r.id + i}>
                      <td>
                        <small>{r.sourceRow}</small>
                      </td>
                      <td>
                        <code style={{ fontSize: 11 }}>{e.field}</code>
                      </td>
                      <td>
                        <code style={{ fontSize: 11 }}>{e.code}</code>
                      </td>
                      <td>
                        <small>{e.message}</small>
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
