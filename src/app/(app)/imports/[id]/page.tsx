import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { prepareImport, commitImport } from "../actions";
export const dynamic = "force-dynamic";
export default async function ImportDetail({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  await requireUser(["ADMIN"]);
  const j = await db.importJob.findUnique({ where: { id: params.id } });
  if (!j) notFound();
  const bad = await db.importRow.findMany({ where: { jobId: j.id, status: "INVALID" }, orderBy: { sourceRow: "asc" }, take: 200 });
  const rows = await db.importRow.findMany({ where: { jobId: j.id }, orderBy: { sourceRow: "asc" }, take: 200, include: { matchedItem: true, matchedEmployee: true } });
  return (
    <>
      <h1>{j.filename} <span className={`badge ${j.status === "FAILED" ? "REJECTED" : "APPROVED"}`}>{j.status.toLowerCase()}</span></h1>
      {searchParams.error && <div className="err">{searchParams.error}</div>}
      <div className="grid"><div className="card"><small>Rows</small><div className="big">{j.totalRows}</div></div><div className="card"><small>Valid</small><div className="big">{j.validRows}</div></div><div className="card"><small>With errors</small><div className="big">{j.invalidRows}</div></div></div>
      {j.errorSummary && <div className="err" style={{ marginTop: 16 }}>{j.errorSummary}</div>}
      {j.status === "VALIDATED" && <form action={prepareImport} style={{ marginTop: 16 }}><input type="hidden" name="id" value={j.id} /><button>Match products and prepare preview</button></form>}
      {j.status === "VALIDATED" && <div className="card" style={{ marginTop: 16 }}><small>Preparation matches variants and employees without changing stock.</small></div>}
      {j.status === "AWAITING_APPROVAL" && <div className="card" style={{ marginTop: 16 }}><small>This import is awaiting an authorized approval. No stock has changed.</small></div>}
      {j.status === "COMMITTED" && <div className="card" style={{ marginTop: 16 }}><small>Committed at {j.committedAt?.toISOString()}.</small></div>}
      {j.status === "VALIDATED" && rows.length > 0 && <div className="card scroll" style={{ marginTop: 16 }}><table><thead><tr><th>Row</th><th>Variant</th><th>Employee</th><th>Match</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.sourceRow}</td><td>{row.matchedItem ? `${row.matchedItem.sku} · ${row.matchedItem.name}` : "Not matched"}</td><td>{row.matchedEmployee?.empId || "—"}</td><td>{row.status.toLowerCase()}</td></tr>)}</tbody></table></div>}
      {((j.status === "VALIDATED" && j.mode === "HISTORICAL") || (j.status === "AWAITING_APPROVAL" && j.type === "RECIPIENT" && j.mode === "NEW")) && <form action={commitImport} style={{ marginTop: 16 }}><input type="hidden" name="id" value={j.id} /><button>{j.mode === "NEW" ? "Create pending distribution requests" : "Commit historical records"}</button></form>}
      {bad.length > 0 && <><div className="row" style={{ justifyContent: "space-between" }}><h2>Rows with errors</h2><Link href={`/imports/${j.id}/errors`}><button className="ghost">Download error report</button></Link></div>
        <div className="card scroll"><table><thead><tr><th>Row</th><th>Field</th><th>Code</th><th>Message</th></tr></thead><tbody>
          {bad.flatMap((r) => (r.errors as any[]).map((e, i) => <tr key={r.id + i}><td>{r.sourceRow}</td><td>{e.field}</td><td>{e.code}</td><td>{e.message}</td></tr>))}
        </tbody></table></div></>}
    </>
  );
}
