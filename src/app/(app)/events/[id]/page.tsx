import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { EventDetailView, EventDetailData, AvailableItem, AvailableEmployee } from "./event-detail-view";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; success?: string };
}) {
  const u = await requireUser();

  const event = await db.event.findUnique({
    where: { id: params.id },
    include: {
      distributions: {
        include: {
          employee: {
            select: {
              id: true,
              empId: true,
              name: true,
              baseLocation: true,
              department: true,
            },
          },
          item: {
            select: {
              id: true,
              sku: true,
              name: true,
              quantity: true,
              unit: true,
            },
          },
        },
        orderBy: { distributionDate: "desc" },
      },
      requests: {
        include: {
          requester: { select: { name: true } },
          employee: { select: { name: true } },
          lines: {
            select: {
              id: true,
              itemId: true,
              itemName: true,
              quantity: true,
            },
          },
        },
        orderBy: { number: "desc" },
      },
    },
  });

  if (!event) notFound();

  // Stock movements posted for this event
  const movements = await db.stockMovement.findMany({
    where: {
      OR: [
        { sourceType: "EVENT", sourceId: event.id },
        { refId: event.id },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      item: { select: { sku: true, name: true } },
    },
    take: 50,
  });

  // Fetch actor names for movements
  const actorIds = Array.from(new Set(movements.map((m) => m.actorId)));
  const actors = await db.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true },
  });
  const actorMap = new Map(actors.map((a) => [a.id, a.name]));

  // Available catalog items for distribution form
  const rawItems = await db.item.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const availableItems: AvailableItem[] = rawItems.map((i) => ({
    id: i.id,
    sku: i.sku,
    name: i.name,
    size: i.size,
    color: i.color,
    brand: i.brand,
    category: i.category,
    unit: i.unit,
    quantity: Number(i.quantity),
  }));

  // Active employees for lookup and duplicate check
  const rawEmployees = await db.employee.findMany({
    where: { active: true },
    include: {
      distributions: {
        select: { itemId: true },
      },
    },
    orderBy: { empId: "asc" },
  });

  const availableEmployees: AvailableEmployee[] = rawEmployees.map((e) => ({
    id: e.id,
    empId: e.empId,
    name: e.name,
    baseLocation: e.baseLocation,
    department: e.department,
    email: e.email,
    collectedItemIds: Array.from(new Set(e.distributions.map((d) => d.itemId))),
  }));

  // Authoritative event-level statistics based on actual database records
  const uniqueRecipients = new Set(event.distributions.map((d) => d.employeeId)).size;
  const recipientRecords = event.distributions.length;
  const itemLines = new Set(event.distributions.map((d) => d.itemId)).size;
  const totalUnitsDistributed = event.distributions
    .filter((d) => d.status === "POSTED" || d.movementId != null)
    .reduce((sum, d) => sum + (Number(d.quantity) || 1), 0);

  const eventDetailData: EventDetailData = {
    id: event.id,
    name: event.name,
    category: event.category,
    dateStr: event.date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    rawDate: event.date.toISOString(),
    location: event.location,
    description: event.description,
    status: event.status,
    uniqueRecipients,
    recipientRecords,
    itemLines,
    totalUnitsDistributed,
    distributions: event.distributions.map((d) => ({
      id: d.id,
      employeeId: d.employeeId,
      empId: d.employee.empId,
      employeeName: d.employee.name,
      employeeLocation: d.employee.baseLocation,
      employeeDept: d.employee.department,
      itemId: d.itemId,
      itemSku: d.item.sku,
      itemName: d.item.name,
      quantity: Number(d.quantity),
      recipientType: d.recipientType || "PARTICIPANT",
      status: d.status,
      movementId: d.movementId,
      distributionDate: d.distributionDate.toLocaleDateString("en-GB"),
      notes: d.notes,
      sourceRef: d.sourceRef,
    })),
    requests: event.requests.map((r) => ({
      id: r.id,
      number: r.number,
      requesterName: r.requester.name,
      employeeId: r.employeeId,
      employeeName: r.employee?.name || null,
      status: r.status,
      purpose: r.purpose,
      submittedAt: r.submittedAt ? r.submittedAt.toLocaleDateString("en-GB") : null,
      lines: r.lines.map((l) => ({
        id: l.id,
        itemId: l.itemId,
        itemName: l.itemName,
        quantity: Number(l.quantity),
      })),
    })),
    stockMovements: movements.map((m) => ({
      id: m.id,
      itemSku: m.item.sku,
      itemName: m.item.name,
      change: Math.abs(Number(m.change)),
      balanceAfter: Number(m.balanceAfter),
      actorName: actorMap.get(m.actorId) || "System",
      createdAt: m.createdAt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      reason: m.reason,
    })),
  };

  return (
    <>
      <PageHeader
        title={event.name}
        description={`Event management workspace for ${event.category} (${eventDetailData.dateStr})`}
        badge={<StatusBadge status={event.status} size="sm" />}
        actions={
          <Link href="/events">
            <button className="ghost" style={{ minHeight: 34, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ArrowLeft size={14} /> Back to Events
            </button>
          </Link>
        }
      />

      {searchParams.error && (
        <div className="err" style={{ marginBottom: 16 }}>
          <AlertTriangle size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
          {searchParams.error}
        </div>
      )}

      {searchParams.success && (
        <div className="notice" style={{ marginBottom: 16 }}>
          <CheckCircle2 size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
          {searchParams.success}
        </div>
      )}

      <EventDetailView
        event={eventDetailData}
        items={availableItems}
        employees={availableEmployees}
        userRole={u.role}
      />
    </>
  );
}
