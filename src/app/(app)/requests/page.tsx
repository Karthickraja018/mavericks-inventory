import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";

export default async function Requests({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const u = await requireUser();
  const statusFilter = searchParams.status as string | undefined;

  // Base filter — executives only see their own requests
  const baseWhere: Record<string, unknown> =
    u.role === "EXECUTIVE" ? { requesterId: u.id } : {};

  // Status filter (from URL param)
  const where = statusFilter ? { ...baseWhere, status: statusFilter } : baseWhere;

  const rs = await db.request.findMany({
    where,
    include: {
      requester: { select: { name: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { number: "desc" },
    take: 200,
  });

  const STATUSES = ["PENDING_MANAGER", "PENDING_AUTHORITY", "APPROVED", "REJECTED", "NEEDS_REVIEW", "DRAFT"];

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
        <h1>Distribution requests</h1>
        {u.role === "EXECUTIVE" && (
          <Link href="/requests/new">
            <button>New request</button>
          </Link>
        )}
      </div>

      {/* Status filter */}
      <form className="card row" style={{ marginBottom: 16 }}>
        <div>
          <label htmlFor="status">Filter by status</label>
          <select id="status" name="status" defaultValue={statusFilter ?? ""}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ").toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 0, display: "flex", alignItems: "end", gap: 8 }}>
          <button className="ghost">Filter</button>
          <a href="/requests"><button type="button" className="ghost">Clear</button></a>
        </div>
      </form>

      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Requester</th>
              <th>Items</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rs.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/requests/${r.id}`}>REQ-{String(r.number).padStart(5, "0")}</Link>
                </td>
                <td>
                  <small>{r.requester.name}</small>
                </td>
                <td>{r._count.lines}</td>
                <td>
                  <span className={`badge ${r.status}`}>{r.status.replace(/_/g, " ").toLowerCase()}</span>
                </td>
                <td>
                  <small>{r.createdAt.toLocaleDateString("en-GB")}</small>
                </td>
                <td>
                  {r.status === "NEEDS_REVIEW" && (u.role === "MANAGER" || u.role === "AUTHORITY") && (
                    <Link
                      href={`/requests/${r.id}/review`}
                      style={{ fontSize: 12, color: "var(--danger)", fontWeight: 600 }}
                    >
                      Resolve →
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rs.length && (
          <div className="empty">
            No requests{statusFilter ? ` with status "${statusFilter.replace(/_/g, " ").toLowerCase()}"` : ""}.
          </div>
        )}
        {rs.length === 200 && (
          <div style={{ padding: "10px 0", color: "var(--muted)", fontSize: 13 }}>
            Showing first 200 results. Use status filter to narrow down.
          </div>
        )}
      </div>
    </>
  );
}
