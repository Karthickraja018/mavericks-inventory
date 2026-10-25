import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";

export default async function ReconciliationHistory({
  searchParams,
}: {
  searchParams: { page?: string; status?: string; q?: string };
}) {
  await requireUser();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = 50;
  const statusFilter = searchParams.status as string | undefined;
  const q = searchParams.q?.trim();

  const where: Record<string, unknown> = {};
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
    db.reconciliationReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        item: { select: { sku: true, name: true } },
        importJob: { select: { filename: true, id: true } },
        requester: { select: { name: true } },
        reviewer: { select: { name: true } },
      },
    }),
    db.reconciliationReview.count({ where }),
  ]);

  const pages = Math.ceil(total / pageSize);

  const STATUSES = ["PENDING_APPROVAL", "APPROVED", "REJECTED", "POSTED"];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reconciliation history</h1>
          <p>Stock count reconciliation records. Stock is only affected when a posted adjustment exists.</p>
        </div>
      </div>

      {/* Filters */}
      <form className="card row" style={{ marginBottom: 16 }}>
        <div>
          <label htmlFor="q">Search SKU or name</label>
          <input id="q" name="q" defaultValue={q} placeholder="SKU or variant name…" />
        </div>
        <div>
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={statusFilter ?? ""}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ").toLowerCase()}
              </option>
            ))}
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
              <th>Date</th>
              <th>Import file</th>
              <th>Row</th>
              <th>Item (SKU · Name)</th>
              <th className="numeric">Balance before</th>
              <th className="numeric">Target</th>
              <th className="numeric">Variance</th>
              <th>Status</th>
              <th>Requester</th>
              <th>Reviewer</th>
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
                  <Link href={`/imports/${r.importJob.id}`} style={{ color: "var(--accent)", fontSize: 12 }}>
                    {r.importJob.filename}
                  </Link>
                </td>
                <td>
                  <small>{r.sourceRow}</small>
                </td>
                <td>
                  <Link href={`/inventory/${r.itemId}`} style={{ fontSize: 13 }}>
                    <code style={{ fontSize: 11 }}>{r.item.sku}</code> · {r.item.name}
                  </Link>
                </td>
                <td className="numeric">{String(r.balanceBefore)}</td>
                <td className="numeric">{String(r.targetBalance)}</td>
                <td
                  className="numeric"
                  style={{
                    fontWeight: 600,
                    color:
                      Number(r.variance) > 0
                        ? "var(--success)"
                        : Number(r.variance) < 0
                          ? "var(--danger)"
                          : undefined,
                  }}
                >
                  {Number(r.variance) > 0 ? "+" : ""}
                  {String(r.variance)}
                </td>
                <td>
                  <span className={`badge ${r.status}`}>{r.status.replace(/_/g, " ").toLowerCase()}</span>
                </td>
                <td>
                  <small>{r.requester.name}</small>
                </td>
                <td>
                  <small>{r.reviewer?.name ?? <span style={{ color: "var(--faint)" }}>—</span>}</small>
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
            No reconciliation records{statusFilter ? " for this status" : ""}.
            {!records.length && !statusFilter && !q && " Run a Stock Count import to create reconciliation records."}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          {page > 1 && (
            <a href={`/reconciliation?page=${page - 1}${statusFilter ? `&status=${statusFilter}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>
              <button className="ghost">← Previous</button>
            </a>
          )}
          <span style={{ color: "var(--muted)", alignSelf: "center", fontSize: 13 }}>
            Page {page} of {pages} · {total} records
          </span>
          {page < pages && (
            <a href={`/reconciliation?page=${page + 1}${statusFilter ? `&status=${statusFilter}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>
              <button className="ghost">Next →</button>
            </a>
          )}
        </div>
      )}
    </>
  );
}
