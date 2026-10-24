import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Requests() {
  const u = await requireUser();
  const rs = await db.request.findMany({ where: u.role === "EXECUTIVE" ? { requesterId: u.id } : {}, include: { requester: true, _count: { select: { lines: true } } }, orderBy: { number: "desc" }, take: 100 });
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "start" }}><h1>Distribution requests</h1>{u.role === "EXECUTIVE" && <Link href="/requests/new"><button>New request</button></Link>}</div>
      <div className="card scroll">
        <table><thead><tr><th>Reference</th><th>Requester</th><th>Items</th><th>Status</th><th>Created</th></tr></thead><tbody>
          {rs.map((r) => <tr key={r.id}><td><Link href={`/requests/${r.id}`}>REQ-{String(r.number).padStart(5, "0")}</Link></td><td>{r.requester.name}</td><td>{r._count.lines}</td><td><span className={`badge ${r.status}`}>{r.status.replace("_", " ").toLowerCase()}</span></td><td>{r.createdAt.toLocaleDateString("en-GB")}</td></tr>)}
        </tbody></table>
        {!rs.length && <div className="empty">No requests yet.</div>}
      </div>
    </>
  );
}
