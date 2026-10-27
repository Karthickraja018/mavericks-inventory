import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { CreateEventDialog } from "./create-event-dialog";
import { EventsListView, EventListItem } from "./events-list-view";
import { Calendar, Users, Gift, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: {
    error?: string;
    success?: string;
  };
}) {
  await requireUser();

  // 1. Fetch all events with distributions and requests
  const events = await db.event.findMany({
    orderBy: { date: "desc" },
    include: {
      distributions: {
        select: {
          id: true,
          employeeId: true,
          itemId: true,
          quantity: true,
          status: true,
          movementId: true,
        },
      },
      requests: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  // 2. Fetch global KPI numbers
  // Unique recipients across all events
  const allEventDistributions = await db.distributionRecord.findMany({
    where: {
      eventId: { not: null },
    },
    select: {
      employeeId: true,
      quantity: true,
      status: true,
      movementId: true,
    },
  });

  const uniqueRecipientsSet = new Set<string>();
  let totalUnitsDistributed = 0;

  allEventDistributions.forEach((d) => {
    uniqueRecipientsSet.add(d.employeeId);
    // Objective B/A: Derive distributed quantities ONLY from authoritative posted distribution transactions
    if (d.status === "POSTED" || d.movementId != null) {
      totalUnitsDistributed += Number(d.quantity) || 1;
    }
  });

  // Pending event approval requests
  const pendingEventRequestsCount = await db.request.count({
    where: {
      eventId: { not: null },
      status: { in: ["PENDING_MANAGER", "PENDING_AUTHORITY"] },
    },
  });

  // 3. Transform events for the list view
  const eventListItems: EventListItem[] = events.map((e) => {
    const eventUniqueRecipients = new Set(e.distributions.map((d) => d.employeeId)).size;

    // Only count posted distributions towards total units distributed
    const eventUnitsDistributed = e.distributions
      .filter((d) => d.status === "POSTED" || d.movementId != null)
      .reduce((acc, d) => acc + (Number(d.quantity) || 1), 0);

    const pendingRequests = e.requests.filter(
      (r) => r.status === "PENDING_MANAGER" || r.status === "PENDING_AUTHORITY"
    ).length;

    const needsReviewRequests = e.requests.filter((r) => r.status === "NEEDS_REVIEW").length;
    const approvedRequests = e.requests.filter((r) => r.status === "APPROVED").length;

    let approvalStatus: "PENDING" | "APPROVED" | "NEEDS_REVIEW" | "NONE" = "NONE";
    if (pendingRequests > 0) {
      approvalStatus = "PENDING";
    } else if (needsReviewRequests > 0) {
      approvalStatus = "NEEDS_REVIEW";
    } else if (approvedRequests > 0 || eventUnitsDistributed > 0) {
      approvalStatus = "APPROVED";
    }

    return {
      id: e.id,
      name: e.name,
      category: e.category,
      dateStr: e.date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      location: e.location,
      description: e.description,
      status: e.status,
      uniqueRecipients: eventUniqueRecipients,
      totalUnitsDistributed: eventUnitsDistributed,
      pendingRequestsCount: pendingRequests,
      totalRequestsCount: e.requests.length,
      approvalStatus,
    };
  });

  return (
    <>
      <PageHeader
        title="Events & Goodies"
        description="Plan corporate events, manage recipient recognition rosters, and track authoritative goodies distribution."
        actions={<CreateEventDialog />}
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

      {/* Compact KPI Row */}
      <div className="grid" style={{ marginBottom: 20 }}>
        <KpiCard
          label="Total Events"
          value={events.length}
          subtext={`${events.filter((e) => e.status === "ACTIVE").length} active events`}
          icon={Calendar}
        />
        <KpiCard
          label="Unique Recipients"
          value={uniqueRecipientsSet.size}
          subtext="Employees recognized across events"
          icon={Users}
        />
        <KpiCard
          label="Goodies Distributed"
          value={`${totalUnitsDistributed.toLocaleString()} pcs`}
          subtext="Authoritative posted distribution"
          icon={Gift}
          variant="success"
        />
        <KpiCard
          label="Pending Approvals"
          value={pendingEventRequestsCount}
          subtext="Event distribution requests in queue"
          icon={Clock}
          variant={pendingEventRequestsCount > 0 ? "warning" : "default"}
        />
      </div>

      {/* Filterable, Searchable Events Management Table */}
      <EventsListView events={eventListItems} />
    </>
  );
}
