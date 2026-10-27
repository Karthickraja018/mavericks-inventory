import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createUser, deleteUser, toggleUser, updateUser } from "../../actions";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { 
  Users as UsersIcon, 
  UserPlus, 
  Search, 
  ShieldCheck, 
  UserX, 
  CheckCircle2, 
  Trash2, 
  Edit3, 
  Lock, 
  Key,
  ShieldAlert,
  Calendar
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Users({
  searchParams,
}: {
  searchParams: { q?: string; error?: string };
}) {
  const currentUser = await requireUser(["ADMIN"]);
  const q = searchParams.q?.trim();
  const [users, total, activeCount, adminAuthorityCount] = await Promise.all([
    db.user.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: { name: "asc" },
    }),
    db.user.count(),
    db.user.count({ where: { active: true } }),
    db.user.count({ where: { role: { in: ["ADMIN", "AUTHORITY"] } } }),
  ]);

  const roleBadgeStyle = (role: string) => {
    switch (role) {
      case "ADMIN":
        return { bg: "rgba(37, 99, 235, 0.1)", color: "var(--primary)", border: "rgba(37, 99, 235, 0.2)" };
      case "AUTHORITY":
        return { bg: "rgba(147, 51, 234, 0.1)", color: "#9333ea", border: "rgba(147, 51, 234, 0.2)" };
      case "MANAGER":
        return { bg: "rgba(245, 158, 11, 0.1)", color: "#b45309", border: "rgba(245, 158, 11, 0.2)" };
      default:
        return { bg: "rgba(100, 116, 139, 0.1)", color: "#475569", border: "rgba(100, 116, 139, 0.2)" };
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader
        title="Users & Access"
        description="Manage workspace team members, role-based authorization levels, and active login sessions."
        breadcrumbs={[
          { label: "Governance" },
          { label: "Users & Access" },
        ]}
      />

      {searchParams.error && (
        <div 
          style={{ 
            padding: "12px 16px", 
            borderRadius: 6, 
            background: "rgba(239, 68, 68, 0.08)", 
            border: "1px solid rgba(239, 68, 68, 0.2)", 
            color: "var(--danger)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <ShieldAlert size={16} />
          <span>{searchParams.error}</span>
        </div>
      )}

      {/* KPI Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <KpiCard
          label="Total Workspace Users"
          value={total.toLocaleString()}
          subtext="Configured user accounts"
          icon={<UsersIcon size={18} />}
        />
        <KpiCard
          label="Active Accounts"
          value={activeCount.toLocaleString()}
          subtext="Valid login permissions"
          variant="success"
          icon={<CheckCircle2 size={18} />}
        />
        <KpiCard
          label="Admins & Authorities"
          value={adminAuthorityCount.toLocaleString()}
          subtext="High-privilege signoffs"
          icon={<ShieldCheck size={18} />}
        />
        <KpiCard
          label="Your Current Session"
          value={currentUser.role}
          subtext={currentUser.email}
          icon={<Key size={18} />}
        />
      </div>

      {/* Create User Section */}
      <div className="card" style={{ padding: 22 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
          <UserPlus size={18} style={{ color: "var(--primary)" }} /> Provision New Workspace User
        </h3>
        <p style={{ fontSize: 13, color: "var(--foreground-muted)", marginBottom: 18 }}>
          Add a team member and assign their role-based security clearance.
        </p>

        <form action={createUser} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, alignItems: "flex-end" }}>
          <div>
            <label htmlFor="new-name" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 6 }}>
              Full Name *
            </label>
            <input id="new-name" name="name" required placeholder="e.g. Sarah Jenkins" style={{ width: "100%" }} />
          </div>

          <div>
            <label htmlFor="new-email" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 6 }}>
              Corporate Email *
            </label>
            <input id="new-email" name="email" type="email" required placeholder="sarah@mavericks.corp" style={{ width: "100%" }} />
          </div>

          <div>
            <label htmlFor="new-role" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 6 }}>
              Access Role *
            </label>
            <select id="new-role" name="role" defaultValue="EXECUTIVE" style={{ width: "100%" }}>
              <option value="EXECUTIVE">Executive (Requisitions & Goodies)</option>
              <option value="MANAGER">Manager (Approvals & Reviews)</option>
              <option value="AUTHORITY">Authority (Final Signoff)</option>
              <option value="ADMIN">Admin (Full System Access)</option>
            </select>
          </div>

          <div>
            <label htmlFor="new-password" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 6 }}>
              Initial Password * (min 8 chars)
            </label>
            <input id="new-password" name="password" type="password" minLength={8} required placeholder="••••••••" style={{ width: "100%" }} />
          </div>

          <div>
            <button type="submit" className="btn primary" style={{ width: "100%", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 6, minHeight: 38 }}>
              <UserPlus size={15} /> Create User
            </button>
          </div>
        </form>
      </div>

      {/* Filter and Search Bar */}
      <form 
        className="card" 
        style={{ 
          display: "flex", 
          flexWrap: "wrap", 
          gap: 14, 
          padding: "16px 20px", 
          alignItems: "flex-end",
          background: "var(--surface)"
        }}
      >
        <div style={{ flex: "1 1 240px" }}>
          <label htmlFor="q" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 6 }}>
            <Search size={14} /> Search Users
          </label>
          <input 
            id="q" 
            name="q" 
            defaultValue={q} 
            placeholder="Search by full name or corporate email…" 
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Search size={14} /> Search
          </button>
          {q && (
            <Link href="/users" className="btn secondary">
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* Users Directory Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
            Authorized Personnel Directory ({users.length} users)
          </div>
        </div>

        <div className="table-container" style={{ margin: 0, border: "none" }}>
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Corporate Email</th>
                <th>Access Role</th>
                <th>Account Status</th>
                <th>Provisioned Date</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const badgeStyle = roleBadgeStyle(u.role);
                return (
                  <tr key={u.id} style={u.active ? undefined : { opacity: 0.65 }}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div 
                          style={{ 
                            width: 32, 
                            height: 32, 
                            borderRadius: "50%", 
                            background: "var(--primary-subtle)", 
                            color: "var(--primary)", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700 
                          }}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                            {u.name}
                            {u.id === currentUser.id && (
                              <span style={{ marginLeft: 6, fontSize: 10, background: "var(--background-subtle)", padding: "1px 6px", borderRadius: 4, color: "var(--foreground-muted)" }}>
                                You
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: 12, color: "var(--foreground-muted)" }}>{u.email}</code>
                    </td>
                    <td>
                      <span 
                        style={{ 
                          display: "inline-flex", 
                          padding: "2px 8px", 
                          borderRadius: 4, 
                          fontSize: 11, 
                          fontWeight: 700,
                          background: badgeStyle.bg,
                          color: badgeStyle.color,
                          border: `1px solid ${badgeStyle.border}`
                        }}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={u.active ? "ACTIVE" : "INACTIVE"} />
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--foreground-muted)" }}>
                        <Calendar size={13} style={{ color: "var(--foreground-subtle)" }} />
                        {u.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <details style={{ position: "relative" }}>
                          <summary className="btn secondary" style={{ fontSize: 11, padding: "4px 8px", listStyle: "none", cursor: "pointer" }}>
                            <Edit3 size={12} /> Edit
                          </summary>
                          <div 
                            style={{ 
                              position: "absolute", 
                              right: 0, 
                              top: "100%", 
                              marginTop: 6, 
                              width: 280, 
                              padding: 16, 
                              background: "var(--surface)", 
                              border: "1px solid var(--border-subtle)", 
                              borderRadius: 6, 
                              boxShadow: "0 10px 25px rgba(0,0,0,0.1)", 
                              zIndex: 50,
                              textAlign: "left"
                            }}
                          >
                            <form action={updateUser} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              <input type="hidden" name="id" value={u.id} />
                              <div>
                                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 4 }}>
                                  Full Name
                                </label>
                                <input name="name" defaultValue={u.name} required style={{ width: "100%", fontSize: 12 }} />
                              </div>
                              <div>
                                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 4 }}>
                                  Corporate Email
                                </label>
                                <input name="email" type="email" defaultValue={u.email} required style={{ width: "100%", fontSize: 12 }} />
                              </div>
                              <div>
                                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 4 }}>
                                  Role Clearance
                                </label>
                                <select name="role" defaultValue={u.role} style={{ width: "100%", fontSize: 12 }}>
                                  <option value="EXECUTIVE">Executive</option>
                                  <option value="MANAGER">Manager</option>
                                  <option value="AUTHORITY">Authority</option>
                                  <option value="ADMIN">Admin</option>
                                </select>
                              </div>
                              <div>
                                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 4 }}>
                                  New Password <small>(leave blank to keep)</small>
                                </label>
                                <input name="password" type="password" minLength={8} style={{ width: "100%", fontSize: 12 }} />
                              </div>
                              <button type="submit" className="btn primary" style={{ width: "100%", fontSize: 12, marginTop: 4 }}>
                                Save Changes
                              </button>
                            </form>
                          </div>
                        </details>

                        <form action={toggleUser} style={{ margin: 0 }}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="active" value={u.active ? "1" : "0"} />
                          <button 
                            type="submit" 
                            className="btn secondary" 
                            style={{ 
                              fontSize: 11, 
                              padding: "4px 8px",
                              color: u.active ? "var(--warning)" : "var(--success)"
                            }}
                          >
                            {u.active ? "Deactivate" : "Activate"}
                          </button>
                        </form>

                        {u.id !== currentUser.id && (
                          <form action={deleteUser} style={{ margin: 0 }}>
                            <input type="hidden" name="id" value={u.id} />
                            <button 
                              type="submit" 
                              className="btn secondary" 
                              style={{ 
                                fontSize: 11, 
                                padding: "4px 8px", 
                                color: "var(--danger)" 
                              }}
                              title="Delete user"
                            >
                              <Trash2 size={12} />
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!users.length && (
          <EmptyState
            icon={<UsersIcon size={32} />}
            title="No users found"
            description={
              q
                ? "No users matched your search query. Try searching for a different name or email."
                : "No users provisioned in the workspace yet."
            }
            action={
              q ? (
                <Link href="/users" className="btn secondary">
                  Clear Search
                </Link>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}

