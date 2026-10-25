import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";

export default async function DistributionHistory({
  searchParams,
}: {
  searchParams: { page?: string; mode?: string; q?: string };
}) {
  await requireUser();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = 50;
  const modeFilter = searchParams.mode as string | undefined;
  const q = searchParams.q?.trim();

  const where: Record<string, unknown> = {};
  if (modeFilter) where.mode = modeFilter;
  if (q) {
    where.OR = [
      { item: { sku: { contains: q, mode: "insensitive" } } },
      { item: { name: { contains: q, mode: "insensitive" } } },
      { employee: { empId: { contains: q, mode: "insensitive" } } },
      { employee: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [records, total] = await Promise.all([
    db.distributionRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        item: { select: { sku: true, name: true } },
        employee: { select: { empId: true, name: true } },
        importJob: { select: { filename: true, id: true } },
      },
    }),
    db.distributionRecord.count({ where }),
  ]);

  const pages = Math.ceil(total / pageSize);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Distribution history</h1>
          <p>
            Historical records are imported provenance only — no stock deduction.
            New distributions create pending requests which require approval before stock is deducted.
          </p>
        </div>
      </div>

      {/* Filters */}
      <form className="card row" style={{ marginBottom: 16 }}>
        <div>
          <label htmlFor="q">Search item or employee</label>
          <input id="q" name="q" defaultValue={q} placeholder="SKU, name, Emp ID…" />
        </div>
        <div>
          <label htmlFor="mode">Mode</label>
          <select id="mode" name="mode" defaultValue={modeFilter ?? ""}>
            <option value="">All modes</option>
            <option value="HISTORICAL">Historical</option>
            <option value="NEW">New (via import)</option>
          </select>
        </div>
        <div style={{ flex: 0, display: "flex", alignItems: "end" }}>
          <button className="ghost">Filter</button>
        </div>
      </form>

      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>Recorded</th>
              <th>Mode</th>
              <th>Distribution date</th>
              <th>Employee</th>
              <th>Item (SKU · Name)</th>
              <th className="numeric">Quantity</th>
              <th>Category</th>
              <th>Status (source)</th>
              <th>Import file</th>
              <th>Row</th>
              <th>Movement ref</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>
                  <small>{r.createdAt.toLocaleDateString("en-GB")}</small>
                </td>
                <td>
                  <span className={`badge ${r.mode === "HISTORICAL" ? "DRAFT" : "PENDING"}`}>
                    {r.mode.toLowerCase()}
                  </span>
                </td>
                <td>
                  <small>{r.distributionDate.toLocaleDateString("en-GB")}</small>
                </td>
                <td>
                  <code style={{ fontSize: 11 }}>{r.employee.empId}</code> · {r.employee.name}
                </td>
                <td>
                  <Link href={`/inventory/${r.itemId}`} style={{ fontSize: 13 }}>
                    <code style={{ fontSize: 11 }}>{r.item.sku}</code> · {r.item.name}
                  </Link>
                </td>
                <td className="numeric" style={{ fontWeight: 600 }}>
                  {String(r.quantity)}
                </td>
                <td>
                  <small>{r.category || <span style={{ color: "var(--faint)" }}>—</span>}</small>
                </td>
                <td>
                  {r.sourceStatus ? (
                    <span className="badge">{r.sourceStatus}</span>
                  ) : (
                    <span style={{ color: "var(--faint)" }}>—</span>
                  )}
                </td>
                <td>
                  {r.importJob ? (
                    <Link href={`/imports/${r.importJob.id}`} style={{ color: "var(--accent)", fontSize: 12 }}>
                      {r.importJob.filename}
                    </Link>
                  ) : (
                    <span style={{ color: "var(--faint)" }}>—</span>
                  )}
                </td>
                <td>
                  <small>{r.sourceRow ?? "—"}</small>
                </td>
                <td>
                  {r.movementId ? (
                    <code style={{ fontSize: 11 }}>…{r.movementId.slice(-8)}</code>
                  ) : (
                    <span style={{ color: "var(--faint)" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!records.length && (
          <div className="empty">
            No distribution records{modeFilter ? " for this mode" : ""}.
            {!records.length && !modeFilter && !q &&
              " Commit a Recipient import to create records."}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          {page > 1 && (
            <a href={`/distribution?page=${page - 1}${modeFilter ? `&mode=${modeFilter}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>
              <button className="ghost">← Previous</button>
            </a>
          )}
          <span style={{ color: "var(--muted)", alignSelf: "center", fontSize: 13 }}>
            Page {page} of {pages} · {total} records
          </span>
          {page < pages && (
            <a href={`/distribution?page=${page + 1}${modeFilter ? `&mode=${modeFilter}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>
              <button className="ghost">Next →</button>
            </a>
          )}
        </div>
      )}
    </>
  );
}
