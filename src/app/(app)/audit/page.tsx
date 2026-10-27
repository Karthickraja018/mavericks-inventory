import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  User, 
  Layers, 
  Clock, 
  Calendar,
  FileSpreadsheet,
  Activity
} from "lucide-react";

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

  const [logs, total, successCount, failureCount, distinctActorsCount] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.auditLog.count({ where }),
    db.auditLog.count({ where: { outcome: "SUCCESS" } }),
    db.auditLog.count({ where: { outcome: { in: ["FAILURE", "BLOCKED"] } } }),
    db.user.count({ where: { active: true } }),
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

  const ENTITIES = ["User", "Item", "Request", "ImportJob", "ImportRow", "StockMovement", "Event"];
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader
        title="Audit Log"
        description="Immutable append-only record of all administrative, inventory, and authorization events across the platform."
        breadcrumbs={[
          { label: "Governance" },
          { label: "Audit Log" },
        ]}
        actions={
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/reports?tab=ledger" className="btn secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <FileSpreadsheet size={15} /> Export Reports
            </Link>
          </div>
        }
      />

      {/* KPI Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <KpiCard
          label="Total Logged Events"
          value={total.toLocaleString()}
          subtext="Audited system actions"
          icon={<ShieldAlert size={18} />}
        />
        <KpiCard
          label="Successful Actions"
          value={successCount.toLocaleString()}
          subtext="Completed authorizations"
          variant="success"
          icon={<CheckCircle2 size={18} />}
        />
        <KpiCard
          label="Blocked / Failures"
          value={failureCount.toLocaleString()}
          subtext="Unauthorized or rejected"
          variant={failureCount > 0 ? "danger" : "default"}
          icon={<AlertTriangle size={18} />}
        />
        <KpiCard
          label="Active Workspace Users"
          value={distinctActorsCount.toLocaleString()}
          subtext="Authorized personnel"
          icon={<User size={18} />}
        />
      </div>

      {/* Filters Form */}
      <form 
        className="card" 
        style={{ 
          display: "flex", 
          flexWrap: "wrap", 
          gap: 14, 
          padding: "16px 20px", 
          alignItems: "flex-end",
          background: "var(--surface)"
        }}
      >
        <div style={{ flex: "1 1 180px" }}>
          <label htmlFor="actor" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 6 }}>
            <User size={14} /> Actor (Name or ID)
          </label>
          <input id="actor" name="actor" defaultValue={actorFilter} placeholder="e.g. Alice" style={{ width: "100%" }} />
        </div>

        <div style={{ flex: "1 1 180px" }}>
          <label htmlFor="entity" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 6 }}>
            <Layers size={14} /> Entity Type
          </label>
          <select id="entity" name="entity" defaultValue={entityFilter ?? ""} style={{ width: "100%" }}>
            <option value="">All entities</option>
            {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        <div style={{ flex: "1 1 180px" }}>
          <label htmlFor="action" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 6 }}>
            <Activity size={14} /> Action Keyword
          </label>
          <input id="action" name="action" defaultValue={actionFilter} placeholder="e.g. APPROVED" style={{ width: "100%" }} />
        </div>

        <div style={{ flex: "1 1 160px" }}>
          <label htmlFor="outcome" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 6 }}>
            <Filter size={14} /> Outcome
          </label>
          <select id="outcome" name="outcome" defaultValue={outcomeFilter ?? ""} style={{ width: "100%" }}>
            <option value="">All outcomes</option>
            {OUTCOMES.map((o) => <option key={o} value={o}>{o.toLowerCase()}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Filter size={14} /> Apply Filter
          </button>
          {(actorFilter || entityFilter || actionFilter || outcomeFilter) && (
            <Link href="/audit" className="btn secondary">
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* Audit Log Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
            Audit History ({total.toLocaleString()} events)
          </div>
          <div style={{ fontSize: 12, color: "var(--foreground-subtle)" }}>
            Showing page {page} of {Math.max(1, pages)}
          </div>
        </div>

        <div className="table-container" style={{ margin: 0, border: "none" }}>
          <table>
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target Entity</th>
                <th>Entity Reference</th>
                <th>Outcome</th>
                <th>Correlation Ref</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500 }}>
                      <Calendar size={13} style={{ color: "var(--foreground-subtle)" }} />
                      {l.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--foreground-subtle)", marginTop: 2 }}>
                      {l.createdAt.toISOString().slice(11, 19)} UTC
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div 
                        style={{ 
                          width: 26, 
                          height: 26, 
                          borderRadius: "50%", 
                          background: "var(--primary-subtle)", 
                          color: "var(--primary)", 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700 
                        }}
                      >
                        {(actorMap.get(l.actorId) || "U").charAt(0).toUpperCase()}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                        {actorMap.get(l.actorId) ?? <code style={{ fontSize: 11 }}>{l.actorId.slice(-8)}</code>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <code style={{ fontSize: 12, padding: "2px 6px", background: "var(--background-subtle)", borderRadius: 4, fontWeight: 600 }}>
                      {l.action}
                    </code>
                  </td>
                  <td>
                    <span 
                      style={{ 
                        display: "inline-flex", 
                        padding: "2px 8px", 
                        borderRadius: 4, 
                        fontSize: 11, 
                        fontWeight: 600,
                        background: "var(--surface-subtle)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--foreground-muted)"
                      }}
                    >
                      {l.entity}
                    </span>
                  </td>
                  <td>
                    <code style={{ fontSize: 11, color: "var(--foreground-subtle)" }}>
                      …{l.entityId.slice(-8)}
                    </code>
                  </td>
                  <td>
                    <StatusBadge status={l.outcome === "SUCCESS" ? "APPROVED" : l.outcome === "FAILURE" ? "REJECTED" : "PENDING"} />
                  </td>
                  <td>
                    {l.correlationId ? (
                      <code style={{ fontSize: 11, color: "var(--foreground-subtle)" }}>
                        …{l.correlationId.slice(-8)}
                      </code>
                    ) : (
                      <span style={{ color: "var(--foreground-subtle)" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!logs.length && (
          <EmptyState
            icon={<ShieldAlert size={32} />}
            title="No audit log entries found"
            description="No audit logs matched the specified filter criteria. Try adjusting or clearing your filters."
            action={
              (actorFilter || entityFilter || actionFilter || outcomeFilter) ? (
                <Link href="/audit" className="btn secondary">
                  Clear Filters
                </Link>
              ) : undefined
            }
          />
        )}

        {/* Pagination Bar */}
        {pages > 1 && (
          <div 
            style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              padding: "12px 20px", 
              borderTop: "1px solid var(--border-subtle)" 
            }}
          >
            <div style={{ fontSize: 13, color: "var(--foreground-subtle)" }}>
              Page {page} of {pages} ({total.toLocaleString()} total entries)
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {page > 1 && (
                <Link
                  href={`/audit${qs({ page: String(page - 1) })}`}
                  className="btn secondary"
                >
                  ← Previous
                </Link>
              )}
              {page < pages && (
                <Link
                  href={`/audit${qs({ page: String(page + 1) })}`}
                  className="btn secondary"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

