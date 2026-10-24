import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";

export default async function ItemHistory({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { page?: string };
}) {
  await requireUser();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = 50;

  const item = await db.item.findUnique({ where: { id: params.id }, include: { product: true } });
  if (!item) notFound();

  const [moves, total] = await Promise.all([
    db.stockMovement.findMany({
      where: { itemId: item.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.stockMovement.count({ where: { itemId: item.id } }),
  ]);

  // Verify ledger consistency (informational only — never auto-correct)
  const ledgerSum = await db.stockMovement
    .aggregate({ _sum: { change: true }, where: { itemId: item.id } })
    .then((r) => Number(r._sum.change ?? 0));

  const cachedQty = Number(item.quantity);
  const discrepancy = Math.abs(ledgerSum - cachedQty) > 0.001;
  const pages = Math.ceil(total / pageSize);

  return (
    <>
      <h1>
        {item.sku} · {item.name}
      </h1>

      {discrepancy && (
        <div className="err">
          ⚠ Ledger discrepancy detected: cached balance is {cachedQty}, sum of movements is {ledgerSum.toFixed(3)}.
          This requires investigation — do not auto-correct. Use a reconciliation import with an authorized approver.
        </div>
      )}

      <div className="grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <small>On hand (cached)</small>
          <div className="big">{String(item.quantity)}</div>
        </div>
        <div className="card">
          <small>Ledger sum</small>
          <div className="big" style={discrepancy ? { color: "var(--bad)" } : undefined}>
            {ledgerSum.toFixed(3)}
          </div>
        </div>
        <div className="card">
          <small>Total movements</small>
          <div className="big">{total}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <table style={{ width: "auto", fontSize: 13 }}>
          <tbody>
            {item.size && (
              <tr>
                <td style={{ color: "var(--mute)", paddingRight: 24 }}>Size / Qty attr</td>
                <td>{item.size}</td>
              </tr>
            )}
            {item.color && (
              <tr>
                <td style={{ color: "var(--mute)", paddingRight: 24 }}>Color</td>
                <td>{item.color}</td>
              </tr>
            )}
            {item.brand && (
              <tr>
                <td style={{ color: "var(--mute)", paddingRight: 24 }}>Brand</td>
                <td>{item.brand}</td>
              </tr>
            )}
            <tr>
              <td style={{ color: "var(--mute)", paddingRight: 24 }}>Unit</td>
              <td>{item.unit}</td>
            </tr>
            <tr>
              <td style={{ color: "var(--mute)", paddingRight: 24 }}>Category</td>
              <td>{item.category}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Stock movement ledger</h2>
      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th style={{ textAlign: "right" }}>Change</th>
              <th style={{ textAlign: "right" }}>Balance after</th>
              <th>Source</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {moves.map((m) => (
              <tr key={m.id}>
                <td>
                  <small>{m.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC</small>
                </td>
                <td>
                  <small>{m.type}</small>
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 600,
                    color: Number(m.change) >= 0 ? "var(--acc)" : "var(--bad)",
                  }}
                >
                  {Number(m.change) >= 0 ? "+" : ""}
                  {String(m.change)}
                </td>
                <td style={{ textAlign: "right" }}>{String(m.balanceAfter)}</td>
                <td>
                  <small>
                    {m.sourceType}
                    {m.sourceId ? ` · …${m.sourceId.slice(-6)}` : ""}
                  </small>
                </td>
                <td>
                  <small style={{ color: "var(--mute)" }}>{m.reason || "—"}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!moves.length && (
          <div className="empty">No stock movements recorded for this item.</div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          {page > 1 && (
            <a href={`/inventory/${item.id}?page=${page - 1}`}>
              <button className="ghost">← Previous</button>
            </a>
          )}
          <span style={{ color: "var(--mute)", alignSelf: "center", fontSize: 13 }}>
            Page {page} of {pages}
          </span>
          {page < pages && (
            <a href={`/inventory/${item.id}?page=${page + 1}`}>
              <button className="ghost">Next →</button>
            </a>
          )}
        </div>
      )}
    </>
  );
}
