import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { uploadImport } from "./actions";

export const dynamic = "force-dynamic";

const KINDS = [
  ["STOCK_COUNT:RECONCILIATION", "Stock Count (reconciliation)"],
  ["PROCUREMENT:HISTORICAL", "Procurement, historical"],
  ["PROCUREMENT:NEW", "Procurement, new"],
  ["RECIPIENT:HISTORICAL", "Recipient, historical"],
  ["RECIPIENT:NEW", "Recipient, new"],
];

export default async function Imports({ searchParams }: { searchParams: { error?: string } }) {
  await requireUser(["ADMIN"]);
  const jobs = await db.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { uploadedBy: true },
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Imports</h1>
          <p>Controlled Excel workbook upload, structural validation, and staged processing.</p>
        </div>
      </div>

      {searchParams.error && <div className="err">{searchParams.error}</div>}

      {/* Upload Form */}
      <form action={uploadImport} className="card row" style={{ marginBottom: 16 }}>
        <div>
          <label htmlFor="kind">Import type and mode</label>
          <select id="kind" name="kind" required defaultValue="">
            <option value="" disabled>
              Select…
            </option>
            {KINDS.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="file">Excel file (.xlsx, up to 10 MB)</label>
          <input id="file" name="file" type="file" accept=".xlsx" required />
        </div>
        <button>Validate file</button>
      </form>
      <p style={{ marginTop: -8, marginBottom: 20 }}>
        <small>Validation only. Nothing is committed and no stock changes upon upload.</small>
      </p>

      {/* Downloadable Synthetic Sample Workbooks */}
      <div className="card" style={{ marginBottom: 24, background: "var(--surface-subtle)" }}>
        <h3 style={{ marginBottom: 6 }}>Download Sample Workbooks & Templates</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 14px" }}>
          Preserves exact column names and orders as defined in the BRD specifications.
        </p>

        <div className="grid" style={{ gap: 12, marginBottom: 14 }}>
          {/* Stock Count */}
          <div style={{ padding: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
            <b>Stock Count</b>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 8px" }}>
              Columns: S.N, Product Details, Product, Size / Quantity, Color, Brand, Procured, Distributed Qty, Available.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <a href="/templates/Stock_Count_Sample_Valid.xlsx" download>
                <button type="button" className="ghost" style={{ fontSize: 12, padding: "4px 10px", minHeight: 30 }}>
                  Download Valid (.xlsx)
                </button>
              </a>
              <a href="/templates/Stock_Count_Sample_Invalid.xlsx" download>
                <button type="button" className="ghost" style={{ fontSize: 12, padding: "4px 10px", minHeight: 30, color: "var(--danger)" }}>
                  Download Invalid (.xlsx)
                </button>
              </a>
            </div>
          </div>

          {/* Procurement */}
          <div style={{ padding: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
            <b>Procurement</b>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 8px" }}>
              Columns: Date, Product Details, Product, Size / Quantity, Color, Brand, Procured.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <a href="/templates/Procurement_Sample_Valid.xlsx" download>
                <button type="button" className="ghost" style={{ fontSize: 12, padding: "4px 10px", minHeight: 30 }}>
                  Download Valid (.xlsx)
                </button>
              </a>
              <a href="/templates/Procurement_Sample_Invalid.xlsx" download>
                <button type="button" className="ghost" style={{ fontSize: 12, padding: "4px 10px", minHeight: 30, color: "var(--danger)" }}>
                  Download Invalid (.xlsx)
                </button>
              </a>
            </div>
          </div>

          {/* Recipient */}
          <div style={{ padding: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
            <b>Recipient (Supplied Template)</b>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 8px" }}>
              12 Columns: Date, Emp ID, Name, Base Location, Category, POC, Product Details, Product, Size / Quantity, Color, Brand, Status.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href="/templates/Recipient_Sample_Valid.xlsx" download>
                <button type="button" className="ghost" style={{ fontSize: 12, padding: "4px 10px", minHeight: 30 }}>
                  Download Supplied 12-Col (.xlsx)
                </button>
              </a>
              <a href="/templates/Recipient_Sample_With_Quantity.xlsx" download>
                <button type="button" className="ghost" style={{ fontSize: 12, padding: "4px 10px", minHeight: 30 }}>
                  Download 13-Col w/ Qty (.xlsx)
                </button>
              </a>
              <a href="/templates/Recipient_Sample_Invalid.xlsx" download>
                <button type="button" className="ghost" style={{ fontSize: 12, padding: "4px 10px", minHeight: 30, color: "var(--danger)" }}>
                  Download Invalid (.xlsx)
                </button>
              </a>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "var(--muted)", background: "var(--surface)", padding: 10, borderRadius: 6, border: "1px solid var(--line)" }}>
          <strong>Note on Recipient Template:</strong> The official supplied Recipient template contains 12 columns and does not include a Quantity column.
          Historical recipient records import as provenance history without deducting stock. New distribution requests source quantities explicitly through the distribution workflow or the updated 13-column template.
        </div>
      </div>

      {/* Import Jobs Table */}
      <h2>Import jobs history</h2>
      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Type</th>
              <th>Mode</th>
              <th>Total Rows</th>
              <th>Valid</th>
              <th>Errors</th>
              <th>Status</th>
              <th>Uploaded By</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>
                  <Link href={`/imports/${j.id}`} style={{ fontWeight: 600, color: "var(--accent)" }}>
                    {j.filename}
                  </Link>
                </td>
                <td>
                  <small>{j.type.replace("_", " ")}</small>
                </td>
                <td>
                  <small>{j.mode.toLowerCase()}</small>
                </td>
                <td style={{ textAlign: "right" }}>{j.totalRows}</td>
                <td style={{ textAlign: "right", color: j.validRows > 0 ? "var(--success)" : undefined }}>
                  {j.validRows}
                </td>
                <td style={{ textAlign: "right", color: j.invalidRows > 0 ? "var(--danger)" : undefined }}>
                  {j.invalidRows}
                </td>
                <td>
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
                    {j.status.replace("_", " ").toLowerCase()}
                  </span>
                </td>
                <td>
                  <small>{j.uploadedBy.name}</small>
                </td>
                <td>
                  <small>{j.createdAt.toLocaleDateString("en-GB")}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!jobs.length && <div className="empty">No imports yet.</div>}
      </div>
    </>
  );
}
