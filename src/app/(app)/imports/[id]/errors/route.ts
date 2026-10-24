import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
const q = (s: unknown) => `"${String(s).replace(/"/g, '""')}"`;
export async function GET(_: Request, { params }: { params: { id: string } }) {
  await requireUser(["ADMIN"]);
  const rows = await db.importRow.findMany({ where: { jobId: params.id, status: "INVALID" }, orderBy: { sourceRow: "asc" } });
  const lines = ["row,field,code,message", ...rows.flatMap((r) => (r.errors as any[]).map((e) => [r.sourceRow, q(e.field), e.code, q(e.message)].join(",")))];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="import-errors.csv"' } });
}
