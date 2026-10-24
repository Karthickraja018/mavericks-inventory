import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createItem } from "../../actions";
export const dynamic = "force-dynamic";

export default async function Inventory({
  searchParams,
}: {
  searchParams: { q?: string; error?: string; inactive?: string };
}) {
  const u = await requireUser();
  const q = searchParams.q?.trim();
  const showInactive = searchParams.inactive === "1";

  const activeFilter = showInactive ? {} : { active: true };
  const items = await db.item.findMany({
    where: q
      ? {
          ...activeFilter,
          OR: [
            { sku: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { size: { contains: q, mode: "insensitive" } },
            { color: { contains: q, mode: "insensitive" } },
            { brand: { contains: q, mode: "insensitive" } },
          ],
        }
      : activeFilter,
    include: { product: { select: { name: true } } },
    orderBy: { sku: "asc" },
    take: 200,
  });

  return (
    <>
      <h1>Inventory</h1>
      {searchParams.error && <div className="err">{searchParams.error}</div>}

      {/* Search */}
      <form className="card row">
        <div>
          <label htmlFor="q">Search SKU, name, size, color or brand</label>
          <input id="q" name="q" defaultValue={q} />
        </div>
        <div style={{ flex: 0, display: "flex", alignItems: "end", gap: 8 }}>
          <label style={{ display: "flex", gap: 6, cursor: "pointer", fontSize: 13, color: "var(--mute)", alignItems: "center" }}>
            <input
              type="checkbox"
              name="inactive"
              value="1"
              defaultChecked={showInactive}
              style={{ width: "auto" }}
            />
            Show inactive
          </label>
          <button className="ghost">Search</button>
        </div>
      </form>

      {/* Admin: add item */}
      {u.role === "ADMIN" && (
        <form action={createItem} className="card row">
          <div>
            <label>SKU *</label>
            <input name="sku" required />
          </div>
          <div>
            <label>Name *</label>
            <input name="name" required />
          </div>
          <div>
            <label>Size / Qty attr</label>
            <input name="size" placeholder="e.g. L, XL, N/A" />
          </div>
          <div>
            <label>Color</label>
            <input name="color" placeholder="e.g. Black, N/A" />
          </div>
          <div>
            <label>Brand</label>
            <input name="brand" placeholder="e.g. Nike, N/A" />
          </div>
          <div>
            <label>Unit</label>
            <input name="unit" defaultValue="pcs" />
          </div>
          <button>Add item</button>
        </form>
      )}

      {/* Item list */}
      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Size</th>
              <th>Color</th>
              <th>Brand</th>
              <th>Unit</th>
              <th style={{ textAlign: "right" }}>On hand</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} style={i.active ? undefined : { opacity: 0.5 }}>
                <td>
                  <code style={{ fontSize: 12 }}>{i.sku}</code>
                </td>
                <td>{i.name}</td>
                <td>{i.size || <span style={{ color: "var(--mute)" }}>—</span>}</td>
                <td>{i.color || <span style={{ color: "var(--mute)" }}>—</span>}</td>
                <td>{i.brand || <span style={{ color: "var(--mute)" }}>—</span>}</td>
                <td>{i.unit}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>
                  <span
                    style={
                      Number(i.quantity) === 0 ? { color: "var(--mute)" } : undefined
                    }
                  >
                    {String(i.quantity)}
                  </span>
                </td>
                <td>
                  {i.active ? (
                    <span className="badge APPROVED">active</span>
                  ) : (
                    <span className="badge REJECTED">inactive</span>
                  )}
                </td>
                <td>
                  <Link href={`/inventory/${i.id}`} style={{ fontSize: 13, color: "var(--acc)" }}>
                    History
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <div className="empty">
            No items match.{u.role === "ADMIN" ? " Admins can add items above." : ""}
          </div>
        )}
        {items.length === 200 && (
          <div style={{ padding: "10px 0", color: "var(--mute)", fontSize: 13 }}>
            Showing first 200 results. Use search to narrow down.
          </div>
        )}
      </div>
    </>
  );
}
