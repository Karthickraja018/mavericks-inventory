import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";

export default async function ProcurementHistory({
  searchParams,
}: {
  searchParams: { page?: string; mode?: string; status?: string; q?: string };
}) {
  await requireUser();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = 50;
  const modeFilter = searchParams.mode as string | undefined;
  const statusFilter = searchParams.status as string | undefined;
  const q = searchParams.q?.trim();

  const where: Record<string, unknown> = {};
  if (modeFilter) where.mode = modeFilter;
  if (statusFilter) where.status = statusFilter;
  if (q) {
    where.item = {
      OR: [
        { sku: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  const [records, total] = await Promise.all([
    db.procurementRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        item: { select: { sku: true, name: true } },
        importJob: { select: { filename: true, id: true } },
        approver: { select: { name: true } },
      },
    }),
    db.procurementRecord.count({ where }),
  ]);

  const pages = Math.ceil(total / pageSize);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Procurement history</h1>
          <p>
            Historical records preserve provenance without changing stock.
            New procurement stock-in requires approved stock movement.
          </p>
        </div>
      </div>

      {/* Filters */}
      <form className="card row" style={{ marginBottom: 16 }}>
        <div>
          <label htmlFor="q">Search SKU or name</label>
          <input id="q" name="q" defaultValue={q} placeholder="SKU or variant name…" />
        </div>
        <div>
          <label htmlFor="mode">Mode</label>
          <select id="mode" name="mode" defaultValue={modeFilter ?? ""}>
            <option value="">All modes</option>
            <option value="HISTORICAL">Historical</option>
            <option value="NEW">New</option>
          </select>
        </div>
        <div>
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={statusFilter ?? ""}>
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="POSTED">Posted</option>
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
              <th>Source date</th>
              <th>Item (SKU · Name)</th>
              <th className="numeric">Quantity</th>
              <th>Status</th>
              <th>Import file</th>
              <th>Row</th>
              <th>Approver</th>
              <th>Approved at</th>
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
                  <small>{r.procurementDate.toLocaleDateString("en-GB")}</small>
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
                  <span className={`badge ${r.status}`}>{r.status.toLowerCase()}</span>
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
                  <small>{r.approver?.name ?? <span style={{ color: "var(--faint)" }}>—</span>}</small>
                </td>
                <td>
                  <small>
                    {r.approvedAt ? r.approvedAt.toLocaleDateString("en-GB") : <span style={{ color: "var(--faint)" }}>—</span>}
                  </small>
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
            No procurement records{modeFilter || statusFilter ? " for these filters" : ""}.
            {!records.length && !modeFilter && !statusFilter && !q &&
              " Commit a Procurement import to create records."}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          {page > 1 && (
            <a href={`/procurement?page=${page - 1}${modeFilter ? `&mode=${modeFilter}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>
              <button className="ghost">← Previous</button>
            </a>
          )}
          <span style={{ color: "var(--muted)", alignSelf: "center", fontSize: 13 }}>
            Page {page} of {pages} · {total} records
          </span>
          {page < pages && (
            <a href={`/procurement?page=${page + 1}${modeFilter ? `&mode=${modeFilter}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>
              <button className="ghost">Next →</button>
            </a>
          )}
        </div>
      )}
    </>
  );
}
