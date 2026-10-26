import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { decide } from "../../actions";
import { approveImportStock } from "../imports/actions";
export const dynamic = "force-dynamic";
export default async function Approvals({ searchParams }: { searchParams: { error?: string } }) {
  const u = await requireUser(["MANAGER", "AUTHORITY"]);
  const rs = await db.request.findMany({ where: { status: u.role === "MANAGER" ? "PENDING_MANAGER" : "PENDING_AUTHORITY" }, include: { requester: true, lines: { include: { item: true } } }, orderBy: { number: "asc" } });
  const imports = await db.importJob.findMany({
    where: { status: "AWAITING_APPROVAL", type: { in: ["STOCK_COUNT", "PROCUREMENT"] }, uploadedById: { not: u.id } },
    include: {
      uploadedBy: true,
      rows: {
        where: { status: "VALID" },
        orderBy: { sourceRow: "asc" },
        include: { matchedItem: { select: { sku: true, name: true, quantity: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return (
    <>
      <h1>Approvals</h1>
      {searchParams.error && <div className="err">{searchParams.error}</div>}
      {!rs.length && <div className="card empty">Nothing is waiting for your approval.</div>}
      {rs.map((r) => (
        <form action={decide} className="card" key={r.id}>
          <input type="hidden" name="id" value={r.id} />
          <b>REQ-{String(r.number).padStart(5, "0")}</b> <small>from {r.requester.name}{r.purpose ? ` · ${r.purpose}` : ""}</small>
          <div className="scroll"><table><thead><tr><th>Item</th><th>Requested</th><th>In stock</th></tr></thead><tbody>
            {r.lines.map((l) => <tr key={l.id}><td>{l.itemName}</td><td>{String(l.quantity)}</td><td style={l.item.quantity.lt(l.quantity) ? { color: "var(--bad)" } : undefined}>{String(l.item.quantity)}</td></tr>)}
          </tbody></table></div>
          <div className="row" style={{ marginTop: 12 }}>
            <div><label htmlFor={`r${r.id}`}>Remarks (required to reject)</label><input id={`r${r.id}`} name="remarks" /></div>
            <button name="decision" value="reject" className="danger">Reject</button><button name="decision" value="approve">Approve</button>
          </div>
        </form>
      ))}
      {imports.length > 0 && <><h2>Import approvals</h2>{imports.map((job) => {
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
          <form action={approveImportStock} className="card" key={job.id}>
            <input type="hidden" name="id" value={job.id} />
            <b>{job.type.replace("_", " ")} / {job.mode}</b>
            <small> · {job.filename} · uploaded by {job.uploadedBy.name}</small>
            {isStockCount ? (
              <>
                <div className="grid" style={{ margin: "14px 0" }}>
                  <div><small>Rows reviewed</small><div className="big">{rows.length}</div></div>
                  <div><small>Balances changed</small><div className="big">{changed.length}</div></div>
                  <div><small>Total increase</small><div className="big" style={{ color: "var(--success)" }}>+{increase}</div></div>
                  <div><small>Total decrease</small><div className="big" style={{ color: "var(--danger)" }}>-{decrease}</div></div>
                </div>
                <p style={{ color: "var(--muted)", fontSize: 13 }}>
                  Approval will set each target balance and post an auditable reconciliation movement. Zero-variance rows do not change stock.
                </p>
                <div className="scroll">
                  <table>
                    <thead><tr><th>Row</th><th>Item</th><th className="numeric">Before</th><th className="numeric">Counted target</th><th className="numeric">Change</th><th>Count checks</th></tr></thead>
                    <tbody>{rows.map(({ row, before, target, variance }) => {
                      const raw = row.raw as Record<string, unknown>;
                      return <tr key={row.id}>
                        <td><small>{row.sourceRow}</small></td>
                        <td><code style={{ fontSize: 11 }}>{row.matchedItem?.sku}</code> · {row.matchedItem?.name}</td>
                        <td className="numeric">{before}</td>
                        <td className="numeric">{target}</td>
                        <td className="numeric" style={{ fontWeight: 600, color: variance > 0 ? "var(--success)" : variance < 0 ? "var(--danger)" : "var(--muted)" }}>
                          {variance > 0 ? "+" : ""}{variance}
                        </td>
                        <td><small>Procured: {String(raw.Procured ?? "—")} · Distributed: {String(raw["Distributed Qty"] ?? "—")}</small></td>
                      </tr>;
                    })}</tbody>
                  </table>
                </div>
              </>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>Review the staged procurement rows before approving stock-in. No stock has changed yet.</p>
            )}
            <div className="row" style={{ marginTop: 12 }}>
              <div style={{ flex: 1 }}>
                <label htmlFor={`i${job.id}`}>{isStockCount ? "Decision reason / reconciliation summary" : "Reason (required to reject)"}</label>
                <input id={`i${job.id}`} name="reason" placeholder={isStockCount ? "Explain the count, variance, or supporting evidence" : undefined} />
              </div>
              <button name="decision" value="reject" className="danger">Reject</button>
              <button name="decision" value="approve">Approve and post</button>
            </div>
          </form>
        );
      })}</>}
    </>
  );
}
