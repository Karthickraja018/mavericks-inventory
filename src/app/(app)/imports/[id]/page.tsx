import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function ImportDetail({ params }: { params: { id: string } }) {
  await requireUser(["ADMIN"]);
  const j = await db.importJob.findUnique({ where: { id: params.id } });
  if (!j) notFound();
  const bad = await db.importRow.findMany({ where: { jobId: j.id, status: "INVALID" }, orderBy: { sourceRow: "asc" }, take: 200 });
  return (
    <>
      <h1>{j.filename} <span className={`badge ${j.status === "FAILED" ? "REJECTED" : "APPROVED"}`}>{j.status.toLowerCase()}</span></h1>
      <div className="grid"><div className="card"><small>Rows</small><div className="big">{j.totalRows}</div></div><div className="card"><small>Valid</small><div className="big">{j.validRows}</div></div><div className="card"><small>With errors</small><div className="big">{j.invalidRows}</div></div></div>
      {j.errorSummary && <div className="err" style={{ marginTop: 16 }}>{j.errorSummary}</div>}
      <div className="card" style={{ marginTop: 16 }}><small>Commit is not available yet. Product and employee matching, duplicate identity and approval rules are waiting on decisions in docs/OPEN_QUESTIONS.md.</small></div>
      {bad.length > 0 && <><div className="row" style={{ justifyContent: "space-between" }}><h2>Rows with errors</h2><Link href={`/imports/${j.id}/errors`}><button className="ghost">Download error report</button></Link></div>
        <div className="card scroll"><table><thead><tr><th>Row</th><th>Field</th><th>Code</th><th>Message</th></tr></thead><tbody>
          {bad.flatMap((r) => (r.errors as any[]).map((e, i) => <tr key={r.id + i}><td>{r.sourceRow}</td><td>{e.field}</td><td>{e.code}</td><td>{e.message}</td></tr>))}
        </tbody></table></div></>}
    </>
  );
}
