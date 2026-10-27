import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Seeding Events, Goodies, and Employee Collections...");

  // 1. Ensure Goodies Items exist with stock
  const goodieItems = [
    { sku: "GD-001", name: "Mavericks Tech Backpack", category: "Goodies", unit: "pcs", quantity: 50 },
    { sku: "GD-002", name: "Stainless Steel Thermal Bottle (750ml)", category: "Goodies", unit: "pcs", quantity: 80 },
    { sku: "GD-003", name: "Wireless Ergonomic Mouse", category: "Electronics", unit: "pcs", quantity: 45 },
    { sku: "GD-004", name: "Premium Mavericks Hoodie (Black)", category: "Apparel", size: "L", color: "Black", unit: "pcs", quantity: 60 },
    { sku: "GD-005", name: "Bluetooth ANC Headphones", category: "Electronics", unit: "pcs", quantity: 30 },
    { sku: "GD-006", name: "Mavericks Ceramic Coffee Mug", category: "Drinkware", unit: "pcs", quantity: 100 },
    { sku: "GD-007", name: "Smart Fitness Band", category: "Electronics", unit: "pcs", quantity: 35 },
  ];

  const itemMap = new Map<string, string>();
  for (const it of goodieItems) {
    const record = await db.item.upsert({
      where: { sku: it.sku },
      update: { name: it.name, quantity: it.quantity, category: it.category },
      create: {
        sku: it.sku,
        name: it.name,
        category: it.category,
        unit: it.unit,
        size: it.size || "",
        color: it.color || "",
        quantity: it.quantity,
      },
    });
    itemMap.set(it.sku, record.id);
  }

  // 2. Events
  const eventsData = [
    {
      name: "Mavericks Annual Hackathon 2026",
      category: "Hackathon",
      location: "HQ Innovation Hub",
      description: "48-hour internal engineering hackathon building AI powered applications.",
      date: new Date("2026-03-15"),
      status: "ACTIVE",
    },
    {
      name: "Spring Sports Meet 2026",
      category: "Sports",
      location: "City Stadium Ground",
      description: "Annual corporate athletics, cricket, and badminton tournament.",
      date: new Date("2026-04-10"),
      status: "ACTIVE",
    },
    {
      name: "Q1 Town Hall & Recognition",
      category: "Town Hall",
      location: "Auditorium A",
      description: "Quarterly all-hands celebration with special achievement awards.",
      date: new Date("2026-01-20"),
      status: "COMPLETED",
    },
  ];

  const eventMap = new Map<string, string>();
  for (const ev of eventsData) {
    const existing = await db.event.findFirst({ where: { name: ev.name } });
    if (existing) {
      eventMap.set(ev.name, existing.id);
    } else {
      const created = await db.event.create({ data: ev });
      eventMap.set(ev.name, created.id);
    }
  }

  // 3. Employees
  const employeeData = [
    { empId: "EMP-001", name: "Karthick Raja", baseLocation: "Chennai", department: "Engineering", email: "karthick@mavericks.test" },
    { empId: "EMP-002", name: "Sarah Jenkins", baseLocation: "Bangalore", department: "Design & UX", email: "sarah@mavericks.test" },
    { empId: "EMP-003", name: "David Chen", baseLocation: "HQ", department: "DevOps & Cloud", email: "david@mavericks.test" },
    { empId: "EMP-004", name: "Priya Sharma", baseLocation: "Hyderabad", department: "Product Management", email: "priya@mavericks.test" },
    { empId: "EMP-005", name: "Michael Scott", baseLocation: "HQ", department: "Sales Operations", email: "michael@mavericks.test" },
    { empId: "EMP-006", name: "Emily Watson", baseLocation: "Chennai", department: "Quality Assurance", email: "emily@mavericks.test" },
    { empId: "EMP-007", name: "Alex Rivera", baseLocation: "Bangalore", department: "Engineering", email: "alex@mavericks.test" },
  ];

  const empMap = new Map<string, string>();
  for (const emp of employeeData) {
    const record = await db.employee.upsert({
      where: { empId: emp.empId },
      update: { name: emp.name, baseLocation: emp.baseLocation, department: emp.department, email: emp.email, active: true },
      create: {
        empId: emp.empId,
        name: emp.name,
        baseLocation: emp.baseLocation,
        department: emp.department,
        email: emp.email,
        active: true,
      },
    });
    empMap.set(emp.empId, record.id);
  }

  // 4. Sample Distributions so Employees have collected items with counts!
  const hackathonId = eventMap.get("Mavericks Annual Hackathon 2026");
  const sportsId = eventMap.get("Spring Sports Meet 2026");
  const townHallId = eventMap.get("Q1 Town Hall & Recognition");

  const sampleDistributions = [
    // Karthick Raja: Winner of Hackathon (Backpack x1, Thermal Bottle x1)
    { empId: "EMP-001", sku: "GD-001", eventId: hackathonId, recipientType: "WINNER", qty: 1, notes: "1st Place Winner - AI Track" },
    { empId: "EMP-001", sku: "GD-002", eventId: townHallId, recipientType: "PARTICIPANT", qty: 1, notes: "Townhall attendee swag" },
    // Sarah Jenkins: Runner Up Sports (Thermal Bottle x2, Mug x1)
    { empId: "EMP-002", sku: "GD-002", eventId: sportsId, recipientType: "RUNNER_UP", qty: 2, notes: "Badminton doubles runner up" },
    { empId: "EMP-002", sku: "GD-006", eventId: townHallId, recipientType: "PARTICIPANT", qty: 1, notes: "Welcome gift" },
    // David Chen: Winner (Headphones x1, Mouse x1)
    { empId: "EMP-003", sku: "GD-005", eventId: hackathonId, recipientType: "WINNER", qty: 1, notes: "Best Infrastructure Hack" },
    { empId: "EMP-003", sku: "GD-003", eventId: townHallId, recipientType: "SPECIAL_RECOGNITION", qty: 1, notes: "Q1 Outstanding Contributor" },
    // Priya Sharma: Participant
    { empId: "EMP-004", sku: "GD-004", eventId: hackathonId, recipientType: "PARTICIPANT", qty: 1, notes: "Hackathon participant hoodie" },
    // Michael Scott: Winner
    { empId: "EMP-005", sku: "GD-007", eventId: sportsId, recipientType: "WINNER", qty: 1, notes: "Marathon 5K Gold Medalist" },
    { empId: "EMP-005", sku: "GD-006", eventId: sportsId, recipientType: "PARTICIPANT", qty: 1, notes: "Sports meet participation mug" },
  ];

  for (const dist of sampleDistributions) {
    const employeeId = empMap.get(dist.empId);
    const itemId = itemMap.get(dist.sku);
    if (!employeeId || !itemId) continue;

    // Check if distribution already recorded to prevent duplicates on rerun
    const existing = await db.distributionRecord.findFirst({
      where: {
        employeeId,
        itemId,
        eventId: dist.eventId,
      },
    });

    if (!existing) {
      await db.distributionRecord.create({
        data: {
          employeeId,
          itemId,
          eventId: dist.eventId,
          recipientType: dist.recipientType,
          quantity: String(dist.qty),
          mode: "NEW",
          distributionDate: new Date(),
          category: dist.recipientType,
          poc: "Eli Executive",
          sourceStatus: "Distributed",
          notes: dist.notes,
        },
      });
    }
  }

  console.log("Seeding complete! Events, Goodies, Employees, and Distribution records are ready.");
}

main()
  .catch((e) => {
    console.error("Error seeding goodies:", e);
  })
  .finally(() => db.$disconnect());
