import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { submitRequest } from "../../../actions";
export const dynamic = "force-dynamic";
export default async function Detail({ params }: { params: { id: string } }) {
  const u = await requireUser();
  const r = await db.request.findUnique({ where: { id: params.id }, include: { lines: true, approvals: { orderBy: { stage: "asc" } }, requester: true } });
  if (!r || (u.role === "EXECUTIVE" && r.requesterId !== u.id)) notFound();
  return (
    <>
      <h1>REQ-{String(r.number).padStart(5, "0")} <span className={`badge ${r.status}`}>{r.status.replace("_", " ").toLowerCase()}</span></h1>
      <div className="card"><small>Requested by {r.requester.name}</small><p style={{ margin: "4px 0 0" }}>{r.purpose || "No purpose given"}</p></div>
      <div className="card scroll"><table><thead><tr><th>Item</th><th>Quantity</th></tr></thead><tbody>{r.lines.map((l) => <tr key={l.id}><td>{l.itemName}</td><td>{String(l.quantity)}</td></tr>)}</tbody></table></div>
      <h2>Approval history</h2>
      <div className="card">{r.approvals.length ? r.approvals.map((a) => <p key={a.id} style={{ margin: "4px 0" }}>Stage {a.stage}: <span className={`badge ${a.decision}`}>{a.decision.toLowerCase()}</span> by {a.approverName}{a.remarks ? ` — ${a.remarks}` : ""}</p>) : <div className="empty">No decisions yet.</div>}</div>
      {r.status === "DRAFT" && r.requesterId === u.id && <form action={submitRequest}><input type="hidden" name="id" value={r.id} /><button>Submit for approval</button></form>}
    </>
  );
}
