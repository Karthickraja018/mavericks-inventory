import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { decide } from "../../actions";
export const dynamic = "force-dynamic";
export default async function Approvals({ searchParams }: { searchParams: { error?: string } }) {
  const u = await requireUser(["MANAGER", "AUTHORITY"]);
  const rs = await db.request.findMany({ where: { status: u.role === "MANAGER" ? "PENDING_MANAGER" : "PENDING_AUTHORITY" }, include: { requester: true, lines: { include: { item: true } } }, orderBy: { number: "asc" } });
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
    </>
  );
}
