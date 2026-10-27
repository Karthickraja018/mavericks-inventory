import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { uploadImport } from "./actions";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Layers, 
  ArrowRight,
  ShieldCheck,
  Calendar,
  Clock
} from "lucide-react";

export const dynamic = "force-dynamic";

const KINDS = [
  ["STOCK_COUNT:RECONCILIATION", "Stock Count (Physical reconciliation)"],
  ["PROCUREMENT:HISTORICAL", "Procurement (Historical provenance)"],
  ["PROCUREMENT:NEW", "Procurement (New inbound stock-in)"],
  ["RECIPIENT:HISTORICAL", "Recipient (Historical distribution provenance)"],
  ["RECIPIENT:NEW", "Recipient (New distribution requests)"],
];

export default async function Imports({ searchParams }: { searchParams: { error?: string } }) {
  await requireUser(["ADMIN"]);
  const jobs = await db.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { uploadedBy: true },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader
        title="Import Center"
        description="Controlled Excel workbook staging, schema validation, entity resolution, and two-stage approvals."
        breadcrumbs={[
          { label: "Governance" },
          { label: "Import Center" },
        ]}
      />

      {searchParams.error && (
        <div 
          style={{ 
            padding: "12px 16px", 
            borderRadius: 6, 
            background: "rgba(239, 68, 68, 0.08)", 
            border: "1px solid rgba(239, 68, 68, 0.2)", 
            color: "var(--danger)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <AlertCircle size={16} />
          <span>{searchParams.error}</span>
        </div>
      )}

      {/* 4-Step Guided Import Workflow */}
      <div 
        className="card" 
        style={{ 
          background: "linear-gradient(180deg, var(--surface) 0%, var(--surface-subtle) 100%)", 
          border: "1px solid var(--border-subtle)",
          padding: 20
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>
          Controlled Staging Sequence
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              1
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Upload & Type</div>
              <div style={{ fontSize: 12, color: "var(--foreground-muted)", marginTop: 2 }}>Upload .xlsx and select operational mode.</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              2
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Validate Structure</div>
              <div style={{ fontSize: 12, color: "var(--foreground-muted)", marginTop: 2 }}>System inspects column headers and data types.</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              3
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Match & Review</div>
              <div style={{ fontSize: 12, color: "var(--foreground-muted)", marginTop: 2 }}>Resolves SKU, employees, and calculates variance.</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              4
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Approve & Commit</div>
              <div style={{ fontSize: 12, color: "var(--foreground-muted)", marginTop: 2 }}>Manager authorization posts stock movements.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Form */}
      <div className="card" style={{ padding: 22 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
          <UploadCloud size={18} style={{ color: "var(--primary)" }} /> Stage New Workbook
        </h3>
        <p style={{ fontSize: 13, color: "var(--foreground-muted)", marginBottom: 18 }}>
          Uploaded spreadsheets are staged into an isolated review environment. No stock or operational records are mutated upon initial upload.
        </p>

        <form action={uploadImport} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, alignItems: "flex-end" }}>
          <div>
            <label htmlFor="kind" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 6 }}>
              Import Type and Operational Mode *
            </label>
            <select id="kind" name="kind" required defaultValue="" style={{ width: "100%" }}>
              <option value="" disabled>Select import category…</option>
              {KINDS.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="file" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 6 }}>
              Excel File (.xlsx, up to 10 MB) *
            </label>
            <input 
              id="file" 
              name="file" 
              type="file" 
              accept=".xlsx" 
              required 
              style={{ width: "100%", padding: "6px 10px" }}
            />
          </div>

          <div>
            <button type="submit" className="btn primary" style={{ width: "100%", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 6, minHeight: 38 }}>
              <ShieldCheck size={16} /> Upload & Validate Structure
            </button>
          </div>
        </form>
      </div>

      {/* Official Downloadable Workbooks & Templates */}
      <div className="card" style={{ padding: 22, background: "var(--surface)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <FileSpreadsheet size={18} style={{ color: "var(--primary)" }} /> Official Templates & Sample Workbooks
            </h3>
            <p style={{ fontSize: 13, color: "var(--foreground-muted)", margin: "4px 0 0" }}>
              Pre-validated column configurations matching exact BRD specification schemas.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {/* Stock Count */}
          <div style={{ padding: 14, background: "var(--background-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Stock Count (Reconciliation)</div>
            <div style={{ fontSize: 11, color: "var(--foreground-subtle)", margin: "4px 0 10px" }}>
              Columns: S.N, Product Details, Product, Size / Quantity, Color, Brand, Procured, Distributed Qty, Available.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <a href="/templates/Stock_Count_Sample_Valid.xlsx" download className="btn secondary" style={{ fontSize: 11, padding: "4px 8px" }}>
                <Download size={12} /> Valid (.xlsx)
              </a>
              <a href="/templates/Stock_Count_Sample_Invalid.xlsx" download className="btn secondary" style={{ fontSize: 11, padding: "4px 8px", color: "var(--danger)" }}>
                <Download size={12} /> Test Error (.xlsx)
              </a>
            </div>
          </div>

          {/* Procurement */}
          <div style={{ padding: 14, background: "var(--background-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Procurement (Inbound)</div>
            <div style={{ fontSize: 11, color: "var(--foreground-subtle)", margin: "4px 0 10px" }}>
              Columns: Date, Product Details, Product, Size / Quantity, Color, Brand, Procured.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <a href="/templates/Procurement_Sample_Valid.xlsx" download className="btn secondary" style={{ fontSize: 11, padding: "4px 8px" }}>
                <Download size={12} /> Valid (.xlsx)
              </a>
              <a href="/templates/Procurement_Sample_Invalid.xlsx" download className="btn secondary" style={{ fontSize: 11, padding: "4px 8px", color: "var(--danger)" }}>
                <Download size={12} /> Test Error (.xlsx)
              </a>
            </div>
          </div>

          {/* Recipient Distribution */}
          <div style={{ padding: 14, background: "var(--background-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Recipient Distribution</div>
            <div style={{ fontSize: 11, color: "var(--foreground-subtle)", margin: "4px 0 10px" }}>
              12 Columns: Date, Emp ID, Name, Base Location, Category, POC, Product Details, Product, Size / Quantity, Color, Brand, Status.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href="/templates/Recipient_Sample_Valid.xlsx" download className="btn secondary" style={{ fontSize: 11, padding: "4px 8px" }}>
                <Download size={12} /> 12-Col (.xlsx)
              </a>
              <a href="/templates/Recipient_Sample_With_Quantity.xlsx" download className="btn secondary" style={{ fontSize: 11, padding: "4px 8px" }}>
                <Download size={12} /> 13-Col w/ Qty (.xlsx)
              </a>
            </div>
          </div>

          {/* Employee Directory */}
          <div style={{ padding: 14, background: "var(--background-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Employee Directory</div>
            <div style={{ fontSize: 11, color: "var(--foreground-subtle)", margin: "4px 0 10px" }}>
              Columns: Emp ID, Name, Department, Email, Location.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <a href="/api/employees/template" download="employee_import_template.xlsx" className="btn secondary" style={{ fontSize: 11, padding: "4px 8px" }}>
                <Download size={12} /> Employee Template (.xlsx)
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Import History Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
            Import Job Audit Trail ({jobs.length} jobs)
          </div>
        </div>

        <div className="table-container" style={{ margin: 0, border: "none" }}>
          <table>
            <thead>
              <tr>
                <th>Workbook Name</th>
                <th>Category</th>
                <th>Mode</th>
                <th className="numeric">Total Rows</th>
                <th className="numeric">Valid</th>
                <th className="numeric">Errors</th>
                <th>Status</th>
                <th>Uploaded By</th>
                <th>Upload Date</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    <Link 
                      href={`/imports/${j.id}`} 
                      style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <FileSpreadsheet size={14} />
                      {j.filename}
                    </Link>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
                      {j.type.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, textTransform: "capitalize", color: "var(--foreground-muted)" }}>
                      {j.mode.toLowerCase()}
                    </span>
                  </td>
                  <td className="numeric" style={{ fontWeight: 600 }}>{j.totalRows}</td>
                  <td className="numeric" style={{ color: j.validRows > 0 ? "var(--success)" : undefined, fontWeight: 600 }}>
                    {j.validRows}
                  </td>
                  <td className="numeric" style={{ color: j.invalidRows > 0 ? "var(--danger)" : "var(--foreground-subtle)", fontWeight: 600 }}>
                    {j.invalidRows}
                  </td>
                  <td>
                    <StatusBadge status={j.status} />
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: "var(--foreground)" }}>{j.uploadedBy.name}</span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ fontSize: 12, color: "var(--foreground-muted)" }}>
                      {j.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!jobs.length && (
          <EmptyState
            icon={<FileSpreadsheet size={32} />}
            title="No import jobs yet"
            description="Upload an Excel workbook above to validate and stage new stock or distribution records."
          />
        )}
      </div>
    </div>
  );
}

