import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createEvent, toggleEventStatus } from "./actions";
import { GoodieDistributor } from "./goodie-distributor";

export const dynamic = "force-dynamic";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: {
    empId?: string;
    eventId?: string;
    role?: string;
    error?: string;
    success?: string;
  };
}) {
  const u = await requireUser();
  const filterEventId = searchParams.eventId;
  const filterRole = searchParams.role;

  // 1. Fetch all events
  const events = await db.event.findMany({
    orderBy: { date: "desc" },
    include: {
      distributions: {
        include: {
          item: { select: { name: true } },
          employee: { select: { empId: true, name: true } },
        },
      },
    },
  });

  // 2. Fetch all active inventory items
  const items = await db.item.findMany({
    where: { active: true },
    select: {
      id: true,
      sku: true,
      name: true,
      size: true,
      color: true,
      brand: true,
      category: true,
      quantity: true,
    },
    orderBy: { name: "asc" },
  });

  // 3. Fetch all active employees with their complete distribution history for duplicate tracking
  const employeesRaw = await db.employee.findMany({
    where: { active: true },
    include: {
      distributions: {
        include: {
          item: { select: { id: true, sku: true, name: true } },
          event: { select: { name: true } },
        },
        orderBy: { distributionDate: "desc" },
      },
    },
    orderBy: { empId: "asc" },
  });

  // Transform employees into the format GoodieDistributor expects
  const employeeOptions = employeesRaw.map((emp) => {
    const itemMap = new Map<
      string,
      {
        itemId: string;
        itemName: string;
        sku: string;
        count: number;
        events: string[];
        roles: string[];
        lastDate: string;
      }
    >();

    emp.distributions.forEach((d) => {
      const q = Number(d.quantity) || 1;
      const existing = itemMap.get(d.itemId);
      const evName = d.event?.name || d.category || "";
      const role = d.recipientType || "";
      if (existing) {
        existing.count += q;
        if (evName && !existing.events.includes(evName)) existing.events.push(evName);
        if (role && !existing.roles.includes(role)) existing.roles.push(role);
      } else {
        itemMap.set(d.itemId, {
          itemId: d.itemId,
          itemName: d.item.name,
          sku: d.item.sku,
          count: q,
          events: evName ? [evName] : [],
          roles: role ? [role] : [],
          lastDate: d.distributionDate.toLocaleDateString("en-GB"),
        });
      }
    });

    return {
      id: emp.id,
      empId: emp.empId,
      name: emp.name,
      baseLocation: emp.baseLocation,
      department: emp.department,
      itemsCollected: Array.from(itemMap.values()),
    };
  });

  // 4. Fetch recent event distributions for the audit/history table
  const whereDist: Record<string, any> = {};
  if (filterEventId) whereDist.eventId = filterEventId;
  if (filterRole) whereDist.recipientType = filterRole;

  const eventDistributions = await db.distributionRecord.findMany({
    where: {
      ...whereDist,
      OR: [{ eventId: { not: null } }, { recipientType: { not: null } }],
    },
    orderBy: { distributionDate: "desc" },
    take: 100,
    include: {
      employee: { select: { empId: true, name: true, baseLocation: true } },
      item: { select: { sku: true, name: true } },
      event: { select: { id: true, name: true, category: true } },
    },
  });

  // Global metric calculations
  const totalEvents = events.length;
  const activeEventsCount = events.filter((e) => e.status === "ACTIVE").length;
  const totalEventGoodies = eventDistributions.reduce((acc, d) => acc + (Number(d.quantity) || 1), 0);
  const totalWinnersRewarded = eventDistributions.filter(
    (d) => d.recipientType === "WINNER" || d.recipientType === "RUNNER_UP"
  ).length;
  const totalParticipantsRewarded = eventDistributions.filter(
    (d) => d.recipientType === "PARTICIPANT" || d.recipientType === "SPECIAL_RECOGNITION"
  ).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Events & Goodies Distribution</h1>
          <p>
            Track corporate events, celebrate winners and participants, and distribute goodies with built-in duplicate tracking.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/employees">
            <button className="ghost" type="button" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>👥</span> View Employee Item Lists
            </button>
          </Link>
        </div>
      </div>

      {searchParams.error && <div className="err">{searchParams.error}</div>}
      {searchParams.success && <div className="ok">{searchParams.success}</div>}

      {/* Top Metric Cards */}
      <div className="grid" style={{ marginBottom: 20 }}>
        <div className="card">
          <span className="metric-label">Total Events</span>
          <div className="big">{totalEvents}</div>
          <small style={{ color: "var(--muted)", marginTop: 4, display: "block" }}>{activeEventsCount} active</small>
        </div>
        <div className="card">
          <span className="metric-label">Goodies Distributed</span>
          <div className="big" style={{ color: "var(--accent)" }}>{totalEventGoodies}</div>
          <small style={{ color: "var(--muted)", marginTop: 4, display: "block" }}>for events</small>
        </div>
        <div className="card">
          <span className="metric-label">Winners Celebrated</span>
          <div className="big" style={{ color: "var(--warning)" }}>{totalWinnersRewarded}</div>
          <small style={{ color: "var(--muted)", marginTop: 4, display: "block" }}>1st/2nd place goodies</small>
        </div>
        <div className="card">
          <span className="metric-label">Participants Rewarded</span>
          <div className="big" style={{ color: "var(--success)" }}>{totalParticipantsRewarded}</div>
          <small style={{ color: "var(--muted)", marginTop: 4, display: "block" }}>participant swag</small>
        </div>
      </div>

      {/* Goodies Distribution Interactive Panel */}
      <GoodieDistributor
        employees={employeeOptions}
        items={items.map((i) => ({ ...i, quantity: Number(i.quantity) }))}
        events={events.map((ev) => ({
          id: ev.id,
          name: ev.name,
          category: ev.category,
          date: ev.date.toLocaleDateString("en-GB"),
          status: ev.status,
        }))}
        preselectedEmpId={searchParams.empId}
      />

      {/* Events List & Quick Create Section */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginTop: 24, marginBottom: 24 }}>
        {/* Create Event Card */}
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span>📅</span> Add New Event
          </h3>
          <form action={createEvent} style={{ display: "grid", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11 }}>Event Name *</label>
              <input name="name" required placeholder="e.g. Annual Hackathon 2026, Sports Day" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ fontSize: 11 }}>Category</label>
                <select name="category" defaultValue="Hackathon">
                  <option value="Hackathon">Hackathon</option>
                  <option value="Sports">Sports Meet</option>
                  <option value="Town Hall">Town Hall</option>
                  <option value="Cultural">Cultural Fest</option>
                  <option value="Recognition">Quarterly Awards</option>
                  <option value="Conference">Conference / Seminar</option>
                  <option value="General">General Event</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11 }}>Date</label>
                <input
                  type="date"
                  name="date"
                  defaultValue={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11 }}>Location / Venue</label>
              <input name="location" placeholder="e.g. HQ Auditorium / Virtual" />
            </div>
            <div>
              <label style={{ fontSize: 11 }}>Description (Optional)</label>
              <input name="description" placeholder="Brief event objectives or themes" />
            </div>
            <button type="submit" style={{ marginTop: 4 }}>
              Create Event
            </button>
          </form>
        </div>

        {/* Existing Events List */}
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Events Master List</h3>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{events.length} tracked event(s)</span>
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto", display: "grid", gap: 8 }}>
            {events.map((ev) => {
              const totalItemsInEvent = ev.distributions.reduce((s, d) => s + (Number(d.quantity) || 1), 0);
              const winnersCount = ev.distributions.filter((d) => d.recipientType === "WINNER" || d.recipientType === "RUNNER_UP").length;
              return (
                <div
                  key={ev.id}
                  style={{
                    padding: "10px 14px",
                    background: "var(--surface-subtle)",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontSize: 14 }}>{ev.name}</strong>
                      <span className={`badge ${ev.status === "ACTIVE" ? "APPROVED" : "DRAFT"}`} style={{ fontSize: 10 }}>
                        {ev.status.toLowerCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      {ev.category} · {ev.date.toLocaleDateString("en-GB")}
                      {ev.location ? ` · ${ev.location}` : ""}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4, display: "flex", gap: 10 }}>
                      <span>🎁 {totalItemsInEvent} goodies given</span>
                      {winnersCount > 0 && <span style={{ color: "var(--warning)" }}>🏆 {winnersCount} winners</span>}
                    </div>
                  </div>
                  <form action={toggleEventStatus}>
                    <input type="hidden" name="id" value={ev.id} />
                    <input type="hidden" name="status" value={ev.status} />
                    <button className="ghost" style={{ fontSize: 11, padding: "2px 8px", minHeight: 26 }}>
                      {ev.status === "ACTIVE" ? "Complete" : "Reopen"}
                    </button>
                  </form>
                </div>
              );
            })}
            {events.length === 0 && (
              <div className="empty">No events created yet. Add your first event using the form.</div>
            )}
          </div>
        </div>
      </div>

      {/* Distribution Log & History Table */}
      <div className="page-head" style={{ marginTop: 20 }}>
        <div>
          <h2>Event Goodies Distribution Log</h2>
          <p>Complete historical ledger of all event goodies awarded to winners and participants.</p>
        </div>
      </div>

      {/* Filters */}
      <form className="card row" style={{ marginBottom: 16 }}>
        <div>
          <label htmlFor="eventId">Filter by Event</label>
          <select id="eventId" name="eventId" defaultValue={filterEventId || ""}>
            <option value="">All Events</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="role">Filter by Recognition Role</label>
          <select id="role" name="role" defaultValue={filterRole || ""}>
            <option value="">All Roles</option>
            <option value="WINNER">Winners</option>
            <option value="RUNNER_UP">Runner-Ups</option>
            <option value="PARTICIPANT">Participants</option>
            <option value="SPECIAL_RECOGNITION">Special Recognition</option>
          </select>
        </div>
        <div style={{ flex: 0, display: "flex", alignItems: "end" }}>
          <button className="ghost">Filter</button>
        </div>
      </form>

      {/* Distribution Records Table */}
      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Employee (Emp ID · Name)</th>
              <th>Item Distributed (SKU · Name)</th>
              <th className="numeric">Quantity</th>
              <th>Recognition Type</th>
              <th>Distributed By (POC)</th>
              <th>Remarks / Notes</th>
              <th>Movement Ref</th>
            </tr>
          </thead>
          <tbody>
            {eventDistributions.map((d) => (
              <tr key={d.id}>
                <td>
                  <small>{d.distributionDate.toLocaleDateString("en-GB")}</small>
                </td>
                <td>
                  <strong>{d.event?.name || d.category || "General Event"}</strong>
                </td>
                <td>
                  <Link href={`/employees?tab=lookup&empId=${d.employee.empId}`}>
                    <code style={{ fontSize: 11 }}>{d.employee.empId}</code> · {d.employee.name}
                  </Link>
                </td>
                <td>
                  <Link href={`/inventory/${d.itemId}`}>
                    <code style={{ fontSize: 11 }}>{d.item.sku}</code> · {d.item.name}
                  </Link>
                </td>
                <td className="numeric" style={{ fontWeight: 700 }}>
                  {String(d.quantity)}
                </td>
                <td>
                  {d.recipientType ? (
                    <span
                      className={`badge ${
                        d.recipientType === "WINNER"
                          ? "APPROVED"
                          : d.recipientType === "RUNNER_UP"
                          ? "PENDING"
                          : "DRAFT"
                      }`}
                    >
                      {d.recipientType === "WINNER" ? "🏆 " : d.recipientType === "RUNNER_UP" ? "🥈 " : "🎖️ "}
                      {d.recipientType.replace("_", " ")}
                    </span>
                  ) : (
                    <span style={{ color: "var(--faint)" }}>—</span>
                  )}
                </td>
                <td>
                  <small>{d.poc || "—"}</small>
                </td>
                <td>
                  <small>{d.notes || "—"}</small>
                </td>
                <td>
                  {d.movementId ? (
                    <code style={{ fontSize: 11 }}>…{d.movementId.slice(-8)}</code>
                  ) : (
                    <span style={{ color: "var(--faint)" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!eventDistributions.length && (
          <div className="empty">No event goodies distributed yet. Use the distribution form above to reward an employee!</div>
        )}
      </div>
    </>
  );
}
