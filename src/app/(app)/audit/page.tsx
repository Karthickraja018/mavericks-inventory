import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";

export default async function Audit({
  searchParams,
}: {
  searchParams: { page?: string; entity?: string; action?: string; actor?: string; outcome?: string };
}) {
  await requireUser(["ADMIN"]);
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = 100;
  const entityFilter = searchParams.entity?.trim();
  const actionFilter = searchParams.action?.trim();
  const actorFilter = searchParams.actor?.trim();
  const outcomeFilter = searchParams.outcome?.trim();

  const where: Record<string, unknown> = {};
  if (entityFilter) where.entity = entityFilter;
  if (actionFilter) where.action = { contains: actionFilter, mode: "insensitive" };
  if (outcomeFilter) where.outcome = outcomeFilter;
  if (actorFilter) {
    // Look up user by name fragment or ID
    const matchingUsers = await db.user.findMany({
      where: {
        OR: [
          { name: { contains: actorFilter, mode: "insensitive" } },
          { id: actorFilter },
        ],
      },
      select: { id: true },
    });
    if (matchingUsers.length) {
      where.actorId = { in: matchingUsers.map((u) => u.id) };
    } else {
      where.actorId = actorFilter; // may return empty if typo, which is correct
    }
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.auditLog.count({ where }),
  ]);

  // Resolve actor names from logged actorIds
  const actorIds = [...new Set(logs.map((l) => l.actorId))];
  const actorMap = new Map<string, string>();
  if (actorIds.length) {
    const users = await db.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true },
    });
    users.forEach((u) => actorMap.set(u.id, u.name));
  }

  const pages = Math.ceil(total / pageSize);

  const ENTITIES = ["User", "Item", "Request", "ImportJob", "ImportRow", "StockMovement"];
  const OUTCOMES = ["SUCCESS", "FAILURE", "BLOCKED"];

  // Build query string helper
  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { entity: entityFilter, action: actionFilter, actor: actorFilter, outcome: outcomeFilter, ...extra };
    Object.entries(merged).forEach(([k, v]) => { if (v) p.set(k, v); });
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <p>Immutable record of all system actions. {total.toLocaleString()} entries total.</p>
        </div>
      </div>

      {/* Filters */}
      <form className="card row" style={{ marginBottom: 16 }}>
        <div>
          <label htmlFor="actor">Actor (name or ID)</label>
          <input id="actor" name="actor" defaultValue={actorFilter} placeholder="e.g. Alice" />
        </div>
        <div>
          <label htmlFor="entity">Entity type</label>
          <select id="entity" name="entity" defaultValue={entityFilter ?? ""}>
            <option value="">All entities</option>
            {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="action">Action contains</label>
          <input id="action" name="action" defaultValue={actionFilter} placeholder="e.g. APPROVED" />
        </div>
        <div>
          <label htmlFor="outcome">Outcome</label>
          <select id="outcome" name="outcome" defaultValue={outcomeFilter ?? ""}>
            <option value="">All outcomes</option>
            {OUTCOMES.map((o) => <option key={o} value={o}>{o.toLowerCase()}</option>)}
          </select>
        </div>
        <div style={{ flex: 0, display: "flex", alignItems: "end", gap: 8 }}>
          <button className="ghost">Filter</button>
          <a href="/audit"><button type="button" className="ghost">Clear</button></a>
        </div>
      </form>

      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>Time (UTC)</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Entity ID</th>
              <th>Outcome</th>
              <th>Correlation</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>
                  <small>{l.createdAt.toISOString().replace("T", " ").slice(0, 19)}</small>
                </td>
                <td>
                  <small>{actorMap.get(l.actorId) ?? <code style={{ fontSize: 11 }}>{l.actorId.slice(-8)}</code>}</small>
                </td>
                <td>
                  <code style={{ fontSize: 11 }}>{l.action}</code>
                </td>
                <td>
                  <small>{l.entity}</small>
                </td>
                <td>
                  <code style={{ fontSize: 11 }}>…{l.entityId.slice(-8)}</code>
                </td>
                <td>
                  <span
                    className={`badge ${l.outcome === "SUCCESS" ? "APPROVED" : l.outcome === "FAILURE" ? "REJECTED" : ""}`}
                  >
                    {l.outcome.toLowerCase()}
                  </span>
                </td>
                <td>
                  {l.correlationId ? (
                    <code style={{ fontSize: 11 }}>…{l.correlationId.slice(-8)}</code>
                  ) : (
                    <span style={{ color: "var(--faint)" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!logs.length && <div className="empty">No audit log entries match the current filters.</div>}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          {page > 1 && (
            <a href={`/audit${qs({ page: String(page - 1) })}`}>
              <button className="ghost">← Previous</button>
            </a>
          )}
          <span style={{ color: "var(--muted)", alignSelf: "center", fontSize: 13 }}>
            Page {page} of {pages} · {total.toLocaleString()} entries
          </span>
          {page < pages && (
            <a href={`/audit${qs({ page: String(page + 1) })}`}>
              <button className="ghost">Next →</button>
            </a>
          )}
        </div>
      )}
    </>
  );
}
