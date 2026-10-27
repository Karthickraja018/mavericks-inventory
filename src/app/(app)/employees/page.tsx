import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { createEmployee, toggleEmployee, updateEmployee, importEmployeesExcel } from "./actions";
import { EmployeeLookupView, EmployeeDetail } from "./employee-lookup-view";

export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    tab?: string;
    empId?: string;
    error?: string;
    success?: string;
  };
}) {
  // Allow all logged-in roles (Executive, Manager, Admin, Authority)
  const u = await requireUser();
  const q = searchParams.q?.trim();
  const activeTab = searchParams.tab === "lookup" || searchParams.empId ? "lookup" : "table";

  // Query employees with their complete distribution history
  const employeesRaw = await db.employee.findMany({
    where: q
      ? {
          OR: [
            { empId: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { baseLocation: { contains: q, mode: "insensitive" } },
            { department: { contains: q, mode: "insensitive" } },
            {
              distributions: {
                some: {
                  item: {
                    OR: [
                      { name: { contains: q, mode: "insensitive" } },
                      { sku: { contains: q, mode: "insensitive" } },
                    ],
                  },
                },
              },
            },
          ],
        }
      : {},
    include: {
      distributions: {
        include: {
          item: { select: { id: true, sku: true, name: true, category: true } },
          event: { select: { id: true, name: true, category: true } },
        },
        orderBy: { distributionDate: "desc" },
      },
    },
    orderBy: { empId: "asc" },
  });

  // Fetch active items for recommendations
  const allItems = await db.item.findMany({
    where: { active: true },
    select: { id: true, sku: true, name: true, category: true, quantity: true },
    orderBy: { name: "asc" },
  });

  // Transform employees into structured detail objects with aggregated item counts
  const employeeDetails: EmployeeDetail[] = employeesRaw.map((emp) => {
    const itemMap = new Map<
      string,
      {
        itemId: string;
        sku: string;
        name: string;
        category: string;
        count: number;
        lastDistributed: string;
        recentEventName: string | null;
        recentRecipientType: string | null;
      }
    >();

    let totalQuantity = 0;

    emp.distributions.forEach((d) => {
      const qNum = Number(d.quantity) || 1;
      totalQuantity += qNum;
      const existing = itemMap.get(d.itemId);
      if (existing) {
        existing.count += qNum;
      } else {
        itemMap.set(d.itemId, {
          itemId: d.itemId,
          sku: d.item.sku,
          name: d.item.name,
          category: d.item.category,
          count: qNum,
          lastDistributed: d.distributionDate.toLocaleDateString("en-GB"),
          recentEventName: d.event?.name || d.category || null,
          recentRecipientType: d.recipientType || null,
        });
      }
    });

    const items = Array.from(itemMap.values()).sort((a, b) => b.count - a.count);

    const history = emp.distributions.map((d) => ({
      id: d.id,
      date: d.distributionDate.toLocaleDateString("en-GB"),
      itemName: d.item.name,
      sku: d.item.sku,
      quantity: Number(d.quantity) || 1,
      eventName: d.event?.name || d.category || null,
      recipientType: d.recipientType || null,
      poc: d.poc || null,
    }));

    return {
      id: emp.id,
      empId: emp.empId,
      name: emp.name,
      baseLocation: emp.baseLocation,
      department: emp.department,
      email: emp.email,
      active: emp.active,
      totalQuantity,
      uniqueItemCount: items.length,
      items,
      history,
    };
  });

  const totalEmployees = employeeDetails.length;
  const activeCount = employeeDetails.filter((e) => e.active).length;
  const employeesWithGoodies = employeeDetails.filter((e) => e.totalQuantity > 0).length;
  const totalItemsDistributed = employeeDetails.reduce((sum, e) => sum + e.totalQuantity, 0);

  return (
    <>
      <PageHeader
        title="Employees & Items Collected"
        description="Track staff members, manage rosters via Excel sheet import, and monitor authoritative counts of items and goodies collected by each employee."
        actions={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <a href="/api/employees/template" download>
              <button className="ghost" type="button" style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 34, fontSize: 13 }}>
                <span>📥</span> Download Excel Template
              </button>
            </a>
            <Link href="/events">
              <button type="button" style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 34, fontSize: 13 }}>
                <span>🎁</span> Distribute Goodies
              </button>
            </Link>
          </div>
        }
      />

      {searchParams.error && <div className="err">{searchParams.error}</div>}
      {searchParams.success && <div className="ok">{searchParams.success}</div>}

      {/* Metrics Row */}
      <div className="grid" style={{ marginBottom: 20 }}>
        <div className="card">
          <span className="metric-label">Total Employees</span>
          <div className="big">{totalEmployees}</div>
          <small style={{ color: "var(--muted)", marginTop: 4, display: "block" }}>{activeCount} active</small>
        </div>
        <div className="card">
          <span className="metric-label">Employees with Goodies</span>
          <div className="big">{employeesWithGoodies}</div>
          <small style={{ color: "var(--muted)", marginTop: 4, display: "block" }}>
            {totalEmployees > 0 ? `${Math.round((employeesWithGoodies / totalEmployees) * 100)}% rewarded` : "0%"}
          </small>
        </div>
        <div className="card">
          <span className="metric-label">Total Items Collected</span>
          <div className="big" style={{ color: "var(--accent)" }}>{totalItemsDistributed}</div>
          <small style={{ color: "var(--muted)", marginTop: 4, display: "block" }}>across all events</small>
        </div>
        <div className="card">
          <span className="metric-label">Active Goodie Variants</span>
          <div className="big">{allItems.length}</div>
          <small style={{ color: "var(--muted)", marginTop: 4, display: "block" }}>available in inventory</small>
        </div>
      </div>

      {/* Top Action Bars: Excel Import & Add Employee Accordions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 20 }}>
        {/* Excel Import Card */}
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
              <span>📊</span> Import Employees from Excel (.xlsx)
            </h3>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px" }}>
            Upload an Excel sheet with columns: <strong>Emp ID</strong>, <strong>Name</strong>, <strong>Base Location</strong>, <strong>Department</strong>.
          </p>
          <form action={importEmployeesExcel} encType="multipart/form-data" style={{ display: "grid", gap: 10 }}>
            <input
              type="file"
              name="file"
              accept=".xlsx"
              required
              style={{ fontSize: 13, padding: "6px" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <a href="/api/employees/template" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "underline" }}>
                Sample format (.xlsx)
              </a>
              <button type="submit" style={{ padding: "0 16px", minHeight: 34 }}>
                Upload & Import
              </button>
            </div>
          </form>
        </div>

        {/* Add Single Employee Card */}
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
            <span>➕</span> Add New Employee
          </h3>
          <form action={createEmployee} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={{ fontSize: 11 }}>Emp ID *</label>
              <input name="empId" required placeholder="e.g. EMP-101" style={{ minHeight: 32 }} />
            </div>
            <div>
              <label style={{ fontSize: 11 }}>Full Name *</label>
              <input name="name" required placeholder="e.g. Alex Morgan" style={{ minHeight: 32 }} />
            </div>
            <div>
              <label style={{ fontSize: 11 }}>Base Location</label>
              <input name="baseLocation" placeholder="HQ / Chennai" defaultValue="HQ" style={{ minHeight: 32 }} />
            </div>
            <div>
              <label style={{ fontSize: 11 }}>Department</label>
              <input name="department" placeholder="Engineering" style={{ minHeight: 32 }} />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" style={{ padding: "0 16px", minHeight: 32 }}>
                Save Employee
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Tabs Switcher: All Employees Table vs Interactive Lookup */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--line)", marginBottom: 16 }}>
        <Link
          href={`/employees?tab=table${q ? `&q=${encodeURIComponent(q)}` : ""}`}
          style={{
            padding: "10px 18px",
            fontWeight: 600,
            fontSize: 14,
            borderBottom: activeTab === "table" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "table" ? "var(--accent)" : "var(--muted)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>📋</span> All Employees & Items Collected ({employeeDetails.length})
        </Link>
        <Link
          href={`/employees?tab=lookup${q ? `&q=${encodeURIComponent(q)}` : ""}`}
          style={{
            padding: "10px 18px",
            fontWeight: 600,
            fontSize: 14,
            borderBottom: activeTab === "lookup" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "lookup" ? "var(--accent)" : "var(--muted)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>🔍</span> Choose Employee by ID & Item Inspector
        </Link>
      </div>

      {/* TAB 1: ALL EMPLOYEES & ITEMS COLLECTED TABLE */}
      {activeTab === "table" && (
        <>
          {/* Search Bar */}
          <form className="card row" style={{ marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="q">Search Employee ID, Name, Location, Dept, or Item Collected</label>
              <input id="q" name="q" defaultValue={q} placeholder="e.g. E001, John, Bottle, Engineering..." />
            </div>
            <button className="ghost" style={{ minHeight: 36 }}>
              Filter
            </button>
            {q && (
              <Link href="/employees">
                <button type="button" className="ghost" style={{ minHeight: 36 }}>
                  Reset
                </button>
              </Link>
            )}
          </form>

          {/* THE MASTER TABLE: List of Employees and Items Collected with Count */}
          <div className="card scroll">
            <table>
              <thead>
                <tr>
                  <th>Emp ID</th>
                  <th>Employee Name</th>
                  <th>Location & Dept</th>
                  <th style={{ minWidth: 280 }}>Items Collected (with Count)</th>
                  <th className="numeric">Total Goodies</th>
                  <th className="numeric">Unique Items</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employeeDetails.map((e) => (
                  <tr key={e.id} style={e.active ? undefined : { opacity: 0.6 }}>
                    <td>
                      <code style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{e.empId}</code>
                    </td>
                    <td>
                      <Link
                        href={`/employees?tab=lookup&empId=${e.empId}`}
                        style={{ fontWeight: 600, color: "var(--accent)" }}
                        title="Click to view full item breakdown and details"
                      >
                        {e.name}
                      </Link>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>{e.baseLocation}</div>
                      {e.department && <small style={{ color: "var(--muted)" }}>{e.department}</small>}
                    </td>
                    {/* ITEMS COLLECTED WITH COUNT */}
                    <td>
                      {e.items.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxWidth: 450 }}>
                          {e.items.map((item) => (
                            <span
                              key={item.itemId}
                              className="badge"
                              style={{
                                background: "var(--surface-subtle)",
                                border: "1px solid var(--line-strong)",
                                padding: "2px 8px",
                                fontSize: 11,
                                color: "var(--ink-soft)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                              title={`${item.name} (${item.sku}) - Received ${item.count} time(s). Last: ${item.lastDistributed}`}
                            >
                              <span>📦</span>
                              <span>{item.name}</span>
                              <strong
                                style={{
                                  background: "var(--accent-soft)",
                                  color: "var(--accent-dark)",
                                  borderRadius: 4,
                                  padding: "0 4px",
                                  fontSize: 11,
                                }}
                              >
                                ×{item.count}
                              </strong>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "var(--faint)", fontSize: 12 }}>None yet</span>
                      )}
                    </td>
                    <td className="numeric">
                      <span
                        className="badge"
                        style={{
                          fontWeight: 700,
                          background: e.totalQuantity > 0 ? "var(--success-soft)" : "var(--surface-subtle)",
                          color: e.totalQuantity > 0 ? "var(--success)" : "var(--muted)",
                        }}
                      >
                        {e.totalQuantity}
                      </span>
                    </td>
                    <td className="numeric" style={{ fontWeight: 600 }}>
                      {e.uniqueItemCount}
                    </td>
                    <td>
                      {e.active ? (
                        <span className="badge APPROVED">active</span>
                      ) : (
                        <span className="badge REJECTED">inactive</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                        <Link href={`/employees?tab=lookup&empId=${e.empId}`}>
                          <button className="ghost" style={{ fontSize: 11, padding: "3px 8px", minHeight: 28 }}>
                            Lookup
                          </button>
                        </Link>
                        <Link href={`/events?empId=${e.empId}`}>
                          <button style={{ fontSize: 11, padding: "3px 8px", minHeight: 28 }}>
                            + Goodie
                          </button>
                        </Link>
                        {/* Edit dialog */}
                        <details style={{ display: "inline-block" }}>
                          <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--muted)", padding: "4px" }}>
                            ⋯
                          </summary>
                          <div
                            style={{
                              position: "absolute",
                              right: 20,
                              zIndex: 10,
                              background: "var(--surface)",
                              padding: 12,
                              borderRadius: 8,
                              boxShadow: "var(--shadow-md)",
                              border: "1px solid var(--line)",
                              minWidth: 220,
                              textAlign: "left",
                            }}
                          >
                            <form action={updateEmployee} style={{ display: "grid", gap: 6, marginBottom: 8 }}>
                              <input type="hidden" name="id" value={e.id} />
                              <label style={{ fontSize: 11 }}>Name</label>
                              <input name="name" defaultValue={e.name} required style={{ minHeight: 28 }} />
                              <label style={{ fontSize: 11 }}>Location</label>
                              <input name="baseLocation" defaultValue={e.baseLocation} style={{ minHeight: 28 }} />
                              <label style={{ fontSize: 11 }}>Department</label>
                              <input name="department" defaultValue={e.department || ""} style={{ minHeight: 28 }} />
                              <button style={{ fontSize: 11, padding: "3px 8px", minHeight: 26, marginTop: 4 }}>
                                Save Changes
                              </button>
                            </form>
                            <form action={toggleEmployee}>
                              <input type="hidden" name="id" value={e.id} />
                              <input type="hidden" name="active" value={e.active ? "1" : "0"} />
                              <button
                                className="ghost"
                                style={{ width: "100%", fontSize: 11, padding: "3px 8px", minHeight: 26 }}
                              >
                                {e.active ? "Deactivate" : "Activate"}
                              </button>
                            </form>
                          </div>
                        </details>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!employeeDetails.length && (
              <div className="empty">
                No employees found matching the criteria. Add one above or upload an Excel file.
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB 2: INTERACTIVE EMPLOYEE LOOKUP BY EMPLOYEE ID */}
      {activeTab === "lookup" && (
        <EmployeeLookupView
          employees={employeeDetails}
          allItems={allItems.map((i) => ({ ...i, quantity: Number(i.quantity) }))}
          initialEmpId={searchParams.empId}
        />
      )}
    </>
  );
}
