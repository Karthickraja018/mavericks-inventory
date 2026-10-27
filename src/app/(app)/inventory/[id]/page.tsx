import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { deleteItem, toggleItem, updateItem } from "../../../actions";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StockIndicator } from "@/components/ui/stock-indicator";
import { EmptyState } from "@/components/ui/empty-state";
import { Boxes, History, AlertTriangle, ShieldAlert, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ItemDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { page?: string; tab?: string; error?: string };
}) {
  const u = await requireUser();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = 50;
  const activeTab = searchParams.tab || "movements";

  const item = await db.item.findUnique({
    where: { id: params.id },
    include: { product: true },
  });
  if (!item) notFound();

  const [moves, totalMoves, distributions, ledgerAgg] = await Promise.all([
    db.stockMovement.findMany({
      where: { itemId: item.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.stockMovement.count({ where: { itemId: item.id } }),
    db.distributionRecord.findMany({
      where: { itemId: item.id },
      orderBy: { distributionDate: "desc" },
      take: 25,
      include: {
        employee: { select: { empId: true, name: true, baseLocation: true } },
        event: { select: { name: true } },
      },
    }),
    db.stockMovement.aggregate({
      _sum: { change: true },
      where: { itemId: item.id },
    }),
  ]);

  const ledgerSum = Number(ledgerAgg._sum.change ?? 0);
  const cachedQty = Number(item.quantity);
  const discrepancy = Math.abs(ledgerSum - cachedQty) > 0.001;
  const totalPages = Math.ceil(totalMoves / pageSize);

  const totalDistributedUnits = distributions.reduce((acc, d) => acc + Number(d.quantity), 0);

  return (
    <>
      <PageHeader
        title={`${item.sku} · ${item.name}`}
        description={`Product variant in category "${item.category || "General"}". Tracked balance: ${cachedQty} ${item.unit}.`}
        breadcrumbs={[
          { label: "Workspace", href: "/" },
          { label: "Inventory", href: "/inventory" },
          { label: item.sku },
        ]}
        badge={<StatusBadge status={item.active ? "ACTIVE" : "INACTIVE"} size="md" />}
        actions={
          <Link href="/inventory">
            <button className="ghost" style={{ minHeight: 34, fontSize: 13 }}>
              <ArrowLeft size={14} /> Back to Inventory
            </button>
          </Link>
        }
      />

      {searchParams.error && <div className="err">{searchParams.error}</div>}

      {discrepancy && (
        <div
          className="err"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            background: "#fff1f2",
            borderColor: "#fecdd3",
            color: "#9f1239",
          }}
        >
          <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ fontSize: 14 }}>Ledger Discrepancy Detected</strong>
            <p style={{ margin: "4px 0 0", fontSize: 12.5 }}>
              Cached balance on hand ({cachedQty}) differs from the sum of all immutable movements ({ledgerSum.toFixed(3)}).
              Never auto-correct balances directly; perform an authorized Stock Count Reconciliation to adjust with an audit trail.
            </p>
          </div>
        </div>
      )}

      {/* KPI Metrics */}
      <div className="grid" style={{ marginBottom: 20 }}>
        <KpiCard
          label="On-Hand Balance"
          value={<StockIndicator quantity={cachedQty} unit={item.unit} />}
          subtext="Cached ledger balance"
          icon={Boxes}
        />
        <KpiCard
          label="Ledger Sum of Movements"
          value={`${ledgerSum.toFixed(2)} ${item.unit}`}
          subtext={discrepancy ? "Discrepancy flagged" : "In sync with ledger"}
          variant={discrepancy ? "danger" : "success"}
          icon={History}
        />
        <KpiCard
          label="Total Movements"
          value={totalMoves}
          subtext="Auditable ledger records"
          icon={History}
        />
        <KpiCard
          label="Recent Distributions"
          value={distributions.length}
          subtext={`${totalDistributedUnits} units issued to employees`}
          icon={Boxes}
        />
      </div>

      {/* Item Variant Specs Card */}
      <div className="card" style={{ marginBottom: 18, padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Variant Specifications</h3>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>SKU: {item.sku}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, fontSize: 13 }}>
          <div>
            <span style={{ color: "var(--muted)", fontSize: 11, display: "block" }}>Size / Spec</span>
            <strong>{item.size || "Standard / N/A"}</strong>
          </div>
          <div>
            <span style={{ color: "var(--muted)", fontSize: 11, display: "block" }}>Color</span>
            <strong>{item.color || "Standard / N/A"}</strong>
          </div>
          <div>
            <span style={{ color: "var(--muted)", fontSize: 11, display: "block" }}>Brand</span>
            <strong>{item.brand || "Mavericks"}</strong>
          </div>
          <div>
            <span style={{ color: "var(--muted)", fontSize: 11, display: "block" }}>Unit of Measure</span>
            <strong>{item.unit}</strong>
          </div>
          <div>
            <span style={{ color: "var(--muted)", fontSize: 11, display: "block" }}>Category</span>
            <strong>{item.category}</strong>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--line)", marginBottom: 16 }}>
        <Link
          href={`/inventory/${item.id}?tab=movements`}
          style={{
            padding: "8px 16px",
            fontWeight: 600,
            fontSize: 13.5,
            borderBottom: activeTab === "movements" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "movements" ? "var(--accent)" : "var(--muted)",
          }}
        >
          Stock Movement Ledger ({totalMoves})
        </Link>
        <Link
          href={`/inventory/${item.id}?tab=distributions`}
          style={{
            padding: "8px 16px",
            fontWeight: 600,
            fontSize: 13.5,
            borderBottom: activeTab === "distributions" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "distributions" ? "var(--accent)" : "var(--muted)",
          }}
        >
          Distribution History ({distributions.length})
        </Link>
        {u.role === "ADMIN" && (
          <Link
            href={`/inventory/${item.id}?tab=manage`}
            style={{
              padding: "8px 16px",
              fontWeight: 600,
              fontSize: 13.5,
              borderBottom: activeTab === "manage" ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === "manage" ? "var(--accent)" : "var(--muted)",
            }}
          >
            Manage Item Configuration
          </Link>
        )}
      </div>

      {/* TAB 1: STOCK MOVEMENTS LEDGER */}
      {activeTab === "movements" && (
        <div className="card scroll" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Movement Type</th>
                <th className="numeric">Change</th>
                <th className="numeric">Balance After</th>
                <th>Source & Ref</th>
                <th>Reason / Transaction Details</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((m) => {
                const changeNum = Number(m.change);
                return (
                  <tr key={m.id}>
                    <td>
                      <small style={{ color: "var(--ink-soft)" }}>
                        {m.createdAt.toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </td>
                    <td>
                      <StatusBadge status={m.type} size="sm" />
                    </td>
                    <td
                      className="numeric"
                      style={{
                        fontWeight: 700,
                        color: changeNum >= 0 ? "var(--success-dark)" : "var(--danger-dark)",
                      }}
                    >
                      {changeNum >= 0 ? `+${changeNum}` : changeNum} {item.unit}
                    </td>
                    <td className="numeric" style={{ fontWeight: 600 }}>
                      {String(m.balanceAfter)} {item.unit}
                    </td>
                    <td>
                      <span style={{ fontSize: 12 }}>
                        {m.sourceType || "DIRECT"}
                        {m.sourceId ? (
                          <code style={{ fontSize: 10.5, marginLeft: 6 }}>
                            …{m.sourceId.slice(-8)}
                          </code>
                        ) : null}
                      </span>
                    </td>
                    <td>
                      <small style={{ color: "var(--ink-soft)" }}>{m.reason || "—"}</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!moves.length && (
            <EmptyState
              title="No movements recorded"
              description="No stock movements have been posted for this item yet."
            />
          )}

          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderTop: "1px solid var(--line)",
              }}
            >
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Page {page} of {totalPages} ({totalMoves} total movements)
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                {page > 1 && (
                  <Link href={`/inventory/${item.id}?tab=movements&page=${page - 1}`}>
                    <button className="ghost" style={{ minHeight: 30, fontSize: 12 }}>
                      ← Previous
                    </button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`/inventory/${item.id}?tab=movements&page=${page + 1}`}>
                    <button className="ghost" style={{ minHeight: 30, fontSize: 12 }}>
                      Next →
                    </button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DISTRIBUTION HISTORY */}
      {activeTab === "distributions" && (
        <div className="card scroll" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee (Emp ID · Name)</th>
                <th>Event / Purpose</th>
                <th className="numeric">Quantity</th>
                <th>Role / Status</th>
                <th>Point of Contact (POC)</th>
              </tr>
            </thead>
            <tbody>
              {distributions.map((d) => (
                <tr key={d.id}>
                  <td>
                    <small>{d.distributionDate.toLocaleDateString("en-GB")}</small>
                  </td>
                  <td>
                    <Link href={`/employees?tab=lookup&empId=${d.employee.empId}`}>
                      <code style={{ fontSize: 11 }}>{d.employee.empId}</code> · <strong>{d.employee.name}</strong>
                    </Link>
                  </td>
                  <td>{d.event?.name || d.category || "Direct Distribution"}</td>
                  <td className="numeric" style={{ fontWeight: 700 }}>
                    {String(d.quantity)} {item.unit}
                  </td>
                  <td>
                    {d.recipientType ? (
                      <StatusBadge status={d.recipientType} size="sm" />
                    ) : (
                      <span style={{ color: "var(--faint)" }}>—</span>
                    )}
                  </td>
                  <td>
                    <small>{d.poc || "—"}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!distributions.length && (
            <EmptyState
              title="No distributions yet"
              description="This item has not yet been distributed to any employee or event participant."
            />
          )}
        </div>
      )}

      {/* TAB 3: ADMIN MANAGEMENT */}
      {activeTab === "manage" && u.role === "ADMIN" && (
        <div className="card" style={{ maxWidth: 650 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Edit Item Master Data</h3>
          <form action={updateItem} style={{ display: "grid", gap: 12 }}>
            <input type="hidden" name="id" value={item.id} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
              <div>
                <label>SKU *</label>
                <input name="sku" defaultValue={item.sku} required />
              </div>
              <div>
                <label>Name *</label>
                <input name="name" defaultValue={item.name} required />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label>Size / Spec</label>
                <input name="size" defaultValue={item.size} />
              </div>
              <div>
                <label>Color</label>
                <input name="color" defaultValue={item.color} />
              </div>
              <div>
                <label>Brand</label>
                <input name="brand" defaultValue={item.brand} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label>Category</label>
                <input name="category" defaultValue={item.category} />
              </div>
              <div>
                <label>Unit of Measure *</label>
                <input name="unit" defaultValue={item.unit} required />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button type="submit">Save Changes</button>
            </div>
          </form>

          <hr style={{ margin: "24px 0", border: 0, borderTop: "1px solid var(--line)" }} />

          <h3 style={{ margin: "0 0 6px", fontSize: 15, color: "var(--danger)" }}>Status & Lifecycle</h3>
          <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--muted)" }}>
            Deactivated items remain preserved for audit compliance but cannot be selected for new requests or distributions.
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <form action={toggleItem}>
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" className="ghost">
                {item.active ? "Deactivate Item" : "Activate Item"}
              </button>
            </form>
            <form action={deleteItem}>
              <input type="hidden" name="id" value={item.id} />
              <button
                type="submit"
                className="danger"
                onClick={(e) => {
                  if (!confirm("Are you sure? Items with movement or distribution history cannot be deleted.")) {
                    e.preventDefault();
                  }
                }}
              >
                Delete Item
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
