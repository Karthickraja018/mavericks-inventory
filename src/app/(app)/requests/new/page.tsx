import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { RequestForm } from "./request-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireUser(["EXECUTIVE", "ADMIN"]);

  const itemsRaw = await db.item.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const items = itemsRaw.map((it) => ({
    id: it.id,
    sku: it.sku,
    name: it.name,
    size: it.size,
    color: it.color,
    brand: it.brand,
    unit: it.unit,
    quantity: Number(it.quantity),
  }));

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <PageHeader
        title="New Distribution Request"
        description="Create an internal item requisition. Multi-stage approvals ensure inventory availability and managerial oversight."
        breadcrumbs={[
          { label: "Workspace", href: "/" },
          { label: "Distribution Requests", href: "/requests" },
          { label: "New Request" },
        ]}
        actions={
          <Link href="/requests">
            <button className="ghost" style={{ minHeight: 34, fontSize: 13 }}>
              <ArrowLeft size={14} /> Back to Requests
            </button>
          </Link>
        }
      />

      {searchParams.error && <div className="err">{searchParams.error}</div>}

      <RequestForm items={items} />
    </div>
  );
}
