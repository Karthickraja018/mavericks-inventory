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
  searchParams: { error?: string; eventId?: string };
}) {
  await requireUser(["EXECUTIVE", "ADMIN"]);

  const [itemsRaw, eventsRaw] = await Promise.all([
    db.item.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    db.event.findMany({
      orderBy: { date: "desc" },
      select: { id: true, name: true, category: true, date: true, status: true },
    }),
  ]);

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

  const events = eventsRaw.map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    date: e.date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    status: e.status,
  }));

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <PageHeader
        title="New Distribution Request"
        description="Raise an inventory requisition via smart Excel extraction or manual line selection. Automatically links or creates events and recipient records."
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

      <RequestForm items={items} events={events} initialEventId={searchParams.eventId} />
    </div>
  );
}

