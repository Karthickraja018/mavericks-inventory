import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "../actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();

  // Primary navigation — role-conditional
  const nav: [string, string][] = [
    ["/", "Dashboard"],
    ["/inventory", "Inventory"],
    ["/requests", "Requests"],
    ["/reports", "Reports"],
  ];
  if (u.role === "MANAGER" || u.role === "AUTHORITY") nav.push(["/approvals", "Approvals"]);
  if (u.role === "ADMIN") {
    nav.push(
      ["/employees", "Employees"],
      ["/users", "Users"],
      ["/imports", "Imports"],
      ["/audit", "Audit log"],
    );
  }

  return (
    <div className="shell">
      <aside>
        <b className="brand">Mavericks Inventory</b>
        <nav>
          {nav.map(([h, t]) => (
            <Link key={h} href={h}>
              {t}
            </Link>
          ))}
          {/* History sub-section — all authenticated roles */}
          <span className="nav-section">History</span>
          <Link href="/reconciliation">Reconciliation</Link>
          <Link href="/procurement">Procurement</Link>
          <Link href="/distribution">Distribution</Link>
        </nav>
        <form action={logout}>
          <small>
            {u.name} · {u.role.toLowerCase()}
          </small>
          <button className="ghost">Sign out</button>
        </form>
      </aside>
      <main>
        <div className="page-context">
          <span>Operations</span>
          <span className="context-dot">/</span>
          <span>Mavericks Inventory</span>
        </div>
        {children}
      </main>
    </div>
  );
}
