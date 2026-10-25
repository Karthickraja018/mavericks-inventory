import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createUser, deleteUser, toggleUser, updateUser } from "../../actions";
export const dynamic = "force-dynamic";

export default async function Users({
  searchParams,
}: {
  searchParams: { q?: string; error?: string };
}) {
  const currentUser = await requireUser(["ADMIN"]);
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

      <details className="card user-create">
        <summary><strong>Create user</strong><small>Add a new person to the workspace</small></summary>
        <form action={createUser} className="row" style={{ marginTop: 18 }}>
          <div><label htmlFor="new-name">Name</label><input id="new-name" name="name" required /></div>
          <div><label htmlFor="new-email">Email</label><input id="new-email" name="email" type="email" required /></div>
          <div><label htmlFor="new-role">Role</label><select id="new-role" name="role" defaultValue="EXECUTIVE"><option value="EXECUTIVE">Executive</option><option value="MANAGER">Manager</option><option value="AUTHORITY">Authority</option><option value="ADMIN">Admin</option></select></div>
          <div><label htmlFor="new-password">Temporary password</label><input id="new-password" name="password" type="password" minLength={8} required /></div>
          <button>Create user</button>
        </form>
      </details>

      <form className="card row" style={{ marginBottom: 0 }}>
        <div>
          <label htmlFor="q">Search name or email</label>
          <input id="q" name="q" defaultValue={q} />
        </div>
        <div style={{ flex: 0, display: "flex", alignItems: "end" }}>
          <button className="ghost">Search</button>
        </div>
      </form>

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
                  <details>
                    <summary className="table-action">Edit</summary>
                    <form action={updateUser} className="user-edit-form">
                      <input type="hidden" name="id" value={u.id} />
                      <label>Name<input name="name" defaultValue={u.name} required /></label>
                      <label>Email<input name="email" type="email" defaultValue={u.email} required /></label>
                      <label>Role<select name="role" defaultValue={u.role}><option value="EXECUTIVE">Executive</option><option value="MANAGER">Manager</option><option value="AUTHORITY">Authority</option><option value="ADMIN">Admin</option></select></label>
                      <label>New password <small>(leave blank to keep current)</small><input name="password" type="password" minLength={8} /></label>
                      <button>Save changes</button>
                    </form>
                  </details>
                  <form action={toggleUser} style={{ margin: "8px 0 0" }}>
                    <input type="hidden" name="id" value={u.id} /><input type="hidden" name="active" value={u.active ? "1" : "0"} />
                    <button className="ghost" style={{ fontSize: 12, padding: "4px 10px" }}>{u.active ? "Deactivate" : "Activate"}</button>
                  </form>
                  {u.id !== currentUser.id && <form action={deleteUser} style={{ margin: "8px 0 0" }}><input type="hidden" name="id" value={u.id} /><button className="danger" style={{ fontSize: 12, padding: "4px 10px" }}>Delete</button></form>}
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
