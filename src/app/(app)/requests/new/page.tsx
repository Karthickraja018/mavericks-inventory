import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createRequest } from "../../../actions";
export const dynamic = "force-dynamic";
export default async function NewRequest({ searchParams }: { searchParams: { error?: string } }) {
  await requireUser(["EXECUTIVE"]);
  const items = await db.item.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return (
    <>
      <h1>New distribution request</h1>
      {searchParams.error && <div className="err">{searchParams.error}</div>}
      <form action={createRequest} className="card">
        <label htmlFor="purpose">Purpose</label><input id="purpose" name="purpose" />
        <h2>Items</h2>
        {[0, 1, 2, 3, 4].map((i) => (
          <div className="row" key={i} style={{ marginBottom: 10 }}>
            <select name={`item${i}`} aria-label={`Item ${i + 1}`} defaultValue=""><option value="">Select item</option>{items.map((x) => <option key={x.id} value={x.id}>{x.sku} · {x.name} ({String(x.quantity)} {x.unit})</option>)}</select>
            <input name={`qty${i}`} type="number" min="0" step="any" placeholder="Quantity" aria-label={`Quantity ${i + 1}`} />
          </div>
        ))}
        <div className="row"><button name="intent" value="draft" className="ghost">Save draft</button><button name="intent" value="submit">Submit for approval</button></div>
      </form>
    </>
  );
}
