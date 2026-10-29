import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, Search, Filter } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string };
}) {
  const u = await requireUser();
  const statusFilter = searchParams.status?.trim();
  const q = searchParams.q?.trim();

  // Base filter — executives only see their own requests; managers/authorities/admins see all
  const baseWhere: Record<string, unknown> =
    u.role === "EXECUTIVE" ? { requesterId: u.id } : {};

  if (statusFilter) {
    baseWhere.status = statusFilter;
  }

  if (q) {
    baseWhere.OR = [
      { purpose: { contains: q, mode: "insensitive" } },
      { requester: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [requests, statusCounts] = await Promise.all([
    db.request.findMany({
      where: baseWhere,
      include: {
        requester: { select: { name: true, role: true } },
        lines: { select: { quantity: true, itemName: true } },
        event: { select: { id: true, name: true } },
      },
      orderBy: { number: "desc" },
      take: 200,
    }),
    db.request.groupBy({
      by: ["status"],
      where: u.role === "EXECUTIVE" ? { requesterId: u.id } : {},
      _count: { _all: true },
    }),
  ]);

  const countMap = new Map<string, number>();
  statusCounts.forEach((s) => countMap.set(s.status, s._count._all));
  const totalCount = Array.from(countMap.values()).reduce((a, b) => a + b, 0);

  const STATUS_PILLS = [
    { key: "", label: "All Requests", count: totalCount },
    { key: "DRAFT", label: "Drafts", count: countMap.get("DRAFT") || 0 },
    { key: "PENDING_MANAGER", label: "Pending Manager", count: countMap.get("PENDING_MANAGER") || 0 },
    { key: "PENDING_AUTHORITY", label: "Pending Authority", count: countMap.get("PENDING_AUTHORITY") || 0 },
    { key: "NEEDS_REVIEW", label: "Needs Review", count: countMap.get("NEEDS_REVIEW") || 0 },
    { key: "APPROVED", label: "Approved", count: countMap.get("APPROVED") || 0 },
    { key: "REJECTED", label: "Rejected", count: countMap.get("REJECTED") || 0 },
  ];

  return (
    <>
      <PageHeader
        title="Distribution Requests"
        description="Requisition inventory items for team operations and events. Monitored through atomic two-stage approvals."
        breadcrumbs={[
          { label: "Workspace", href: "/" },
          { label: "Distribution Requests" },
        ]}
        actions={
          (u.role === "EXECUTIVE" || u.role === "ADMIN") ? (
            <Link href="/requests/new">
              <button style={{ minHeight: 34, fontSize: 13 }}>
                <Plus size={14} /> New Request
              </button>
            </Link>
          ) : null
        }
      />

      {/* Filter Pills Bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 8,
          marginBottom: 16,
        }}
      >
        {STATUS_PILLS.map((pill) => {
          const isActive = (statusFilter || "") === pill.key;
          return (
            <Link
              key={pill.key}
              href={`/requests${pill.key ? `?status=${pill.key}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: isActive ? 650 : 500,
                background: isActive ? "var(--accent)" : "var(--surface)",
                color: isActive ? "#fff" : "var(--ink-soft)",
                border: isActive ? "1px solid var(--accent)" : "1px solid var(--line)",
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "all .12s",
              }}
            >
              <span>{pill.label}</span>
              <span
                style={{
                  padding: "0 5px",
                  borderRadius: 10,
                  fontSize: 11,
                  background: isActive ? "rgba(255,255,255,0.25)" : "var(--surface-subtle)",
                  color: isActive ? "#fff" : "var(--muted)",
                  fontWeight: 700,
                }}
              >
                {pill.count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Requests Table */}
      <div className="card scroll" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 130 }}>Reference</th>
              <th style={{ width: 160 }}>Requester</th>
              <th>Purpose / Justification</th>
              <th style={{ width: 140 }}>Items Requested</th>
              <th style={{ width: 150 }}>Status</th>
              <th style={{ width: 120 }}>Created</th>
              <th style={{ textAlign: "right", width: 120 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const totalUnits = r.lines.reduce((s, l) => s + Number(l.quantity), 0);
              const isNeedsReview = r.status === "NEEDS_REVIEW";

              return (
                <tr key={r.id}>
                  <td>
                    <Link href={`/requests/${r.id}`}>
                      <code style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>
                        REQ-{String(r.number).padStart(5, "0")}
                      </code>
                    </Link>
                  </td>
                  <td>
                    <strong style={{ fontSize: 13 }}>{r.requester.name}</strong>
                    <small style={{ color: "var(--muted)", display: "block" }}>{r.requester.role.toLowerCase()}</small>
                  </td>
                  <td>
                    <div style={{ fontSize: 13, color: "var(--ink-soft)", maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.event && (
                        <Link
                          href={`/events/${r.event.id}`}
                          style={{
                            display: "inline-block",
                            padding: "1px 6px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 650,
                            background: "var(--accent-soft)",
                            color: "var(--accent-dark)",
                            marginRight: 6,
                            textDecoration: "none",
                          }}
                        >
                          🎪 {r.event.name}
                        </Link>
                      )}
                      <span>{r.purpose || <span style={{ color: "var(--faint)" }}>No purpose specified</span>}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                      {r.lines.length} items <small style={{ color: "var(--muted)" }}>({totalUnits} units)</small>
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={r.status} size="sm" />
                  </td>
                  <td>
                    <small style={{ color: "var(--muted)" }}>
                      {r.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </small>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {isNeedsReview && (u.role === "MANAGER" || u.role === "AUTHORITY") ? (
                      <Link href={`/requests/${r.id}/review`}>
                        <button className="danger" style={{ fontSize: 11, padding: "2px 8px", minHeight: 26 }}>
                          Resolve Review →
                        </button>
                      </Link>
                    ) : (
                      <Link href={`/requests/${r.id}`}>
                        <button className="ghost" style={{ fontSize: 11.5, padding: "2px 8px", minHeight: 26 }}>
                          Inspect →
                        </button>
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!requests.length && (
          <EmptyState
            title="No requests found"
            description={
              statusFilter
                ? `There are currently no requests with status "${statusFilter.replace(/_/g, " ").toLowerCase()}".`
                : "No distribution requests have been created yet."
            }
            action={
              (u.role === "EXECUTIVE" || u.role === "ADMIN") ? (
                <Link href="/requests/new">
                  <button>Create First Request</button>
                </Link>
              ) : undefined
            }
          />
        )}
      </div>
    </>
  );
}
