import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { toggleUser } from "../../actions";
export const dynamic = "force-dynamic";

export default async function Users({
  searchParams,
}: {
  searchParams: { q?: string; error?: string };
}) {
  await requireUser(["ADMIN"]);
  const q = searchParams.q?.trim();
  const users = await db.user.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { name: "asc" },
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Users</h1>
          <p>Manage system access. Deactivating a user invalidates their session on next request.</p>
        </div>
      </div>

      {searchParams.error && <div className="err">{searchParams.error}</div>}

      <form className="card row" style={{ marginBottom: 0 }}>
        <div>
          <label htmlFor="q">Search name or email</label>
          <input id="q" name="q" defaultValue={q} />
        </div>
        <div style={{ flex: 0, display: "flex", alignItems: "end" }}>
          <button className="ghost">Search</button>
        </div>
      </form>

      <p>
        <small>
          New users must be created directly in the database or via the seed script. Password resets and
          user creation through the UI are not implemented (no open business decision authorises it).
        </small>
      </p>

      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={u.active ? undefined : { opacity: 0.55 }}>
                <td>{u.name}</td>
                <td>
                  <code style={{ fontSize: 12 }}>{u.email}</code>
                </td>
                <td>
                  <span className="badge">{u.role.toLowerCase()}</span>
                </td>
                <td>
                  {u.active ? (
                    <span className="badge APPROVED">active</span>
                  ) : (
                    <span className="badge REJECTED">inactive</span>
                  )}
                </td>
                <td>
                  <small>{u.createdAt.toLocaleDateString("en-GB")}</small>
                </td>
                <td>
                  <form action={toggleUser} style={{ margin: 0 }}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="active" value={u.active ? "1" : "0"} />
                    <button
                      className="ghost"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                    >
                      {u.active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length && <div className="empty">No users found.</div>}
      </div>
    </>
  );
}
