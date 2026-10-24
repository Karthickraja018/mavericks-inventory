import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "../actions";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const nav = [["/", "Dashboard"], ["/inventory", "Inventory"], ["/requests", "Requests"], ["/reports", "Reports"]];
  if (u.role === "MANAGER" || u.role === "AUTHORITY") nav.push(["/approvals", "Approvals"]);
  if (u.role === "ADMIN") nav.push(["/imports", "Imports"], ["/audit", "Audit log"]);
  return (
    <div className="shell">
      <aside>
        <b className="brand">Mavericks Inventory</b>
        <nav>{nav.map(([h, t]) => <Link key={h} href={h}>{t}</Link>)}</nav>
        <form action={logout}><small>{u.name} ({u.role.toLowerCase()})</small><button className="ghost">Sign out</button></form>
      </aside>
      <main>{children}</main>
    </div>
  );
}
