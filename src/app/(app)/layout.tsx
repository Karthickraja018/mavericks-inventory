import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "../actions";
import { AppSidebar } from "./sidebar";
import { GlobalHeader } from "@/components/global-header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();

  const approvalStage =
    u.role === "MANAGER"
      ? "PENDING_MANAGER"
      : u.role === "AUTHORITY"
      ? "PENDING_AUTHORITY"
      : null;

  const [pendingApprovalsCount, needsReviewCount] = await Promise.all([
    approvalStage ? db.request.count({ where: { status: approvalStage } }).catch(() => 0) : 0,
    db.request.count({ where: { status: "NEEDS_REVIEW" } }).catch(() => 0),
  ]);

  return (
    <div className="shell">
      <AppSidebar
        user={{ name: u.name, role: u.role }}
        pendingApprovalsCount={pendingApprovalsCount}
        needsReviewCount={needsReviewCount}
        logout={logout}
      />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
        <GlobalHeader
          user={{ name: u.name, role: u.role }}
          pendingApprovalsCount={pendingApprovalsCount}
          needsReviewCount={needsReviewCount}
          logout={logout}
        />
        <main>{children}</main>
      </div>
    </div>
  );
}
