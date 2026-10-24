import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { uploadImport } from "./actions";
export const dynamic = "force-dynamic";
const KINDS = [["STOCK_COUNT:RECONCILIATION", "Stock Count (reconciliation)"], ["PROCUREMENT:HISTORICAL", "Procurement, historical"], ["PROCUREMENT:NEW", "Procurement, new"], ["RECIPIENT:HISTORICAL", "Recipient, historical"], ["RECIPIENT:NEW", "Recipient, new"]];
export default async function Imports({ searchParams }: { searchParams: { error?: string } }) {
  await requireUser(["ADMIN"]);
  const jobs = await db.importJob.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { uploadedBy: true } });
  return (
    <>
      <h1>Imports</h1>
      {searchParams.error && <div className="err">{searchParams.error}</div>}
      <form action={uploadImport} className="card row">
        <div><label htmlFor="kind">Import type and mode</label><select id="kind" name="kind" required defaultValue=""><option value="" disabled>Select…</option>{KINDS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
        <div><label htmlFor="file">Excel file (.xlsx, up to 10 MB)</label><input id="file" name="file" type="file" accept=".xlsx" required /></div>
        <button>Validate file</button>
      </form>
      <p><small>Validation only. Nothing is committed and no stock changes.</small></p>
      <div className="card scroll"><table><thead><tr><th>File</th><th>Type</th><th>Mode</th><th>Rows</th><th>Errors</th><th>Status</th><th>By</th></tr></thead><tbody>
        {jobs.map((j) => <tr key={j.id}><td><Link href={`/imports/${j.id}`}>{j.filename}</Link></td><td>{j.type}</td><td>{j.mode}</td><td>{j.totalRows}</td><td>{j.invalidRows}</td><td><span className={`badge ${j.status === "FAILED" ? "REJECTED" : "APPROVED"}`}>{j.status.toLowerCase()}</span></td><td>{j.uploadedBy.name}</td></tr>)}
      </tbody></table>{!jobs.length && <div className="empty">No imports yet.</div>}</div>
    </>
  );
}
