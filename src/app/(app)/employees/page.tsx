import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createEmployee, toggleEmployee } from "./actions";
export const dynamic = "force-dynamic";

export default async function Employees({
  searchParams,
}: {
  searchParams: { q?: string; error?: string };
}) {
  const u = await requireUser(["ADMIN"]);
  const q = searchParams.q?.trim();
  const employees = await db.employee.findMany({
    where: q
      ? {
          OR: [
            { empId: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { baseLocation: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { empId: "asc" },
    take: 200,
  });

  return (
    <>
      <h1>Employees</h1>
      {searchParams.error && <div className="err">{searchParams.error}</div>}

      <form className="card row">
        <div>
          <label htmlFor="q">Search Emp ID, name or location</label>
          <input id="q" name="q" defaultValue={q} />
        </div>
        <button className="ghost">Search</button>
      </form>

      <form action={createEmployee} className="card row">
        <div>
          <label>Emp ID *</label>
          <input name="empId" required placeholder="e.g. E001" />
        </div>
        <div>
          <label>Name *</label>
          <input name="name" required />
        </div>
        <div>
          <label>Base Location</label>
          <input name="baseLocation" placeholder="e.g. HQ" />
        </div>
        <button>Add employee</button>
      </form>
      <p>
        <small>
          Employees must be created here before they can be matched in Recipient imports. Do not create employees
          automatically during import.
        </small>
      </p>

      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>Emp ID</th>
              <th>Name</th>
              <th>Base Location</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} style={e.active ? undefined : { opacity: 0.55 }}>
                <td>
                  <code style={{ fontSize: 12 }}>{e.empId}</code>
                </td>
                <td>{e.name}</td>
                <td>{e.baseLocation || <span style={{ color: "var(--mute)" }}>—</span>}</td>
                <td>
                  {e.active ? (
                    <span className="badge APPROVED">active</span>
                  ) : (
                    <span className="badge REJECTED">inactive</span>
                  )}
                </td>
                <td>
                  <form action={toggleEmployee} style={{ margin: 0 }}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="active" value={e.active ? "1" : "0"} />
                    <button className={e.active ? "ghost" : "ghost"} style={{ fontSize: 12, padding: "4px 10px" }}>
                      {e.active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!employees.length && (
          <div className="empty">No employees. Add one above to enable Recipient imports.</div>
        )}
      </div>
    </>
  );
}
