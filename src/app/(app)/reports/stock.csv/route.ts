import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const csv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export async function GET() {
  await requireUser();
  const items = await db.item.findMany({ where: { active: true }, orderBy: { sku: "asc" }, include: { product: { select: { name: true } } } });
  const lines = [
    ["sku", "name", "product", "size", "color", "brand", "unit", "quantity", "status"].join(","),
    ...items.map((item) => [item.sku, item.name, item.product?.name, item.size, item.color, item.brand, item.unit, item.quantity, item.quantity.toString() === "0" ? "out_of_stock" : "in_stock"].map(csv).join(",")),
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="current-stock.csv"' } });
}
