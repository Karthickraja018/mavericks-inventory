import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Audit() {
  await requireUser(["ADMIN"]);
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <h1>Audit log</h1>
      <div className="card scroll"><table><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Actor</th></tr></thead><tbody>
        {logs.map((l) => <tr key={l.id}><td>{l.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC</td><td>{l.action}</td><td>{l.entity} {l.entityId.slice(-6)}</td><td>{l.actorId.slice(-6)}</td></tr>)}
      </tbody></table></div>
    </>
  );
}
