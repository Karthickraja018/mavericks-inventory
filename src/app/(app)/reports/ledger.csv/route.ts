import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const csv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export async function GET() {
  const u = await requireUser(["ADMIN", "MANAGER", "AUTHORITY"]);
  const moves = await db.stockMovement.findMany({ orderBy: { createdAt: "asc" }, include: { item: { select: { sku: true, name: true } } } });
  const lines = [
    ["id", "created_at", "sku", "item", "type", "change", "balance_after", "source_type", "source_id", "actor_id", "approved_by", "reason"].join(","),
    ...moves.map((move) => [move.id, move.createdAt.toISOString(), move.item.sku, move.item.name, move.type, move.change, move.balanceAfter, move.sourceType, move.sourceId, move.actorId, move.approvedById, move.reason].map(csv).join(",")),
  ];
  await db.auditLog.create({ data: { actorId: u.id, action: "REPORT_EXPORTED", entity: "StockMovement", entityId: "ledger", detail: { rows: moves.length } } });
  return new Response(lines.join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="stock-ledger.csv"' } });
}
