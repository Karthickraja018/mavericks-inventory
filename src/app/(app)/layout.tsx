import { requireUser } from "@/lib/auth";
import { logout } from "../actions";
import { AppSidebar } from "./sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();

  return (
    <div className="shell">
      <AppSidebar user={{ name: u.name, role: u.role }} logout={logout} />
      <main>
        <div className="page-context"><span>Workspace</span><span className="context-dot">/</span><span>Inventory operations</span></div>
        {children}
      </main>
    </div>
  );
}
