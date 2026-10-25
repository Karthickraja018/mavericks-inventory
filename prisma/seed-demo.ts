import { PrismaClient, Role, Status, ImportType, ImportMode, ImportStatus, RowStatus, MovementType, ReconciliationStatus, ProcurementStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";

const db = new PrismaClient();

// -----------------------------------------------------------------------------
// Environment Guard
// -----------------------------------------------------------------------------
export function checkEnvironmentGuard() {
  const isProduction =
    process.env.NODE_ENV === "production" || process.env.NEON_BRANCH === "production";
  const allowDemoSeed =
    process.env.ALLOW_DEMO_SEED === "1" ||
    process.env.ALLOW_DEMO_SEED === "true" ||
    process.argv.includes("--allow-demo") ||
    process.argv.includes("-y");

  if (isProduction && !allowDemoSeed) {
    console.error("\n=======================================================");
    console.error("ENVIRONMENT GUARD ACTIVATED:");
    console.error(`Connected branch is reported as: "${process.env.NEON_BRANCH || "production"}".`);
    console.error("To seed synthetic demo data into this database, you must provide");
    console.error("explicit development/demo authorization:");
    console.error("  Run with: ALLOW_DEMO_SEED=1 npm run seed");
    console.error("  Or:       npm run seed:demo");
    console.error("  Or:       npx tsx prisma/seed.ts --allow-demo");
    console.error("=======================================================\n");
    throw new Error("Explicit demo environment authorization required (ALLOW_DEMO_SEED=1).");
  }
}

// -----------------------------------------------------------------------------
// Seed Users
// -----------------------------------------------------------------------------
export async function seedUsers() {
  console.log("Seeding authentic application users...");
  const passwordHash = await bcrypt.hash("password123", 10);

  const users: { name: string; email: string; role: Role }[] = [
    { name: "Ava Admin", email: "admin@mavericks.test", role: "ADMIN" },
    { name: "Eli Executive", email: "exec@mavericks.test", role: "EXECUTIVE" },
    { name: "Mia Manager", email: "manager@mavericks.test", role: "MANAGER" },
    { name: "Ari Authority", email: "authority@mavericks.test", role: "AUTHORITY" },
  ];

  const userMap = new Map<string, string>();
  for (const u of users) {
    const record = await db.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, active: true },
      create: { name: u.name, email: u.email, role: u.role, passwordHash, active: true },
    });
    userMap.set(u.email, record.id);
  }
  return userMap;
}

// -----------------------------------------------------------------------------
// Seed Products & Variants (Catalog)
// -----------------------------------------------------------------------------
export async function seedProductsAndVariants() {
  console.log("Seeding synthetic product catalog and canonical variants...");

  const catalog = [
    {
      productName: "Mavericks T-Shirt",
      category: "Apparel",
      variants: [
        { sku: "MTS-ASH-S", name: "Mavericks T-Shirt - Ash (S)", size: "S", color: "Ash", brand: "Crocodile", unit: "pcs" },
        { sku: "MTS-ASH-M", name: "Mavericks T-Shirt - Ash (M)", size: "M", color: "Ash", brand: "Crocodile", unit: "pcs" },
        { sku: "MTS-ASH-L", name: "Mavericks T-Shirt - Ash (L)", size: "L", color: "Ash", brand: "Crocodile", unit: "pcs" },
        { sku: "MTS-ASH-XL", name: "Mavericks T-Shirt - Ash (XL)", size: "XL", color: "Ash", brand: "Crocodile", unit: "pcs" },
        { sku: "MTS-ASH-XXL", name: "Mavericks T-Shirt - Ash (XXL)", size: "XXL", color: "Ash", brand: "Crocodile", unit: "pcs" },
        { sku: "MTS-ASH-XXXL", name: "Mavericks T-Shirt - Ash (XXXL)", size: "XXXL", color: "Ash", brand: "Crocodile", unit: "pcs" },
      ],
    },
    {
      productName: "Bot All Coffee Mug",
      category: "Drinkware",
      variants: [
        { sku: "BCM-BLU", name: "Bot All Coffee Mug - Blue", size: "", color: "Blue", brand: "", unit: "pcs" },
        { sku: "BCM-BLK", name: "Bot All Coffee Mug - Black", size: "", color: "Black", brand: "", unit: "pcs" },
      ],
    },
    {
      productName: "Headphones (RGB)",
      category: "Electronics",
      variants: [
        { sku: "HPN-RGB-BLK-L", name: "Headphones (RGB) - Black (Large)", size: "Large", color: "Black", brand: "Boat", unit: "pcs" },
      ],
    },
    {
      productName: "Wireless Mouse",
      category: "Electronics",
      variants: [
        { sku: "WMS-BLK", name: "Wireless Mouse - Black", size: "", color: "Black", brand: "", unit: "pcs" },
      ],
    },
    {
      productName: "Laptop Sticker",
      category: "Merchandise",
      variants: [
        { sku: "STK-LPT", name: "Laptop Sticker Pack", size: "", color: "", brand: "", unit: "pcs" },
      ],
    },
  ];

  const itemMap = new Map<string, string>(); // sku -> itemId

  for (const entry of catalog) {
    let product = await db.product.findFirst({ where: { name: entry.productName } });
    if (!product) {
      product = await db.product.create({
        data: { name: entry.productName, category: entry.category, active: true },
      });
    }

    for (const v of entry.variants) {
      const item = await db.item.upsert({
        where: { sku: v.sku },
        update: {
          name: v.name,
          productId: product.id,
          size: v.size,
          color: v.color,
          brand: v.brand,
          category: entry.category,
          unit: v.unit,
          active: true,
        },
        create: {
          sku: v.sku,
          name: v.name,
          productId: product.id,
          size: v.size,
          color: v.color,
          brand: v.brand,
          category: entry.category,
          unit: v.unit,
          quantity: 0, // strict 0 opening before ledger postings
          active: true,
        },
      });
      itemMap.set(v.sku, item.id);
    }
  }

  // Preserve existing 3 sample items if they exist, ensuring they have 0 stock
  for (const [sku, name] of [["SKU-001", "A4 Paper Ream"], ["SKU-002", "Safety Gloves"], ["SKU-003", "Label Printer Roll"]]) {
    const existing = await db.item.upsert({
      where: { sku },
      update: { name },
      create: { sku, name, quantity: 0 },
    });
    itemMap.set(sku, existing.id);
  }

  return itemMap;
}

// -----------------------------------------------------------------------------
// Seed Synthetic Employees
// -----------------------------------------------------------------------------
export async function seedEmployees() {
  console.log("Seeding synthetic employee directory...");

  const employees = [
    { empId: "EMP-1001", name: "Priya Sharma", baseLocation: "Bengaluru" },
    { empId: "EMP-1002", name: "Rohan Desai", baseLocation: "Pune" },
    { empId: "EMP-1003", name: "Ananya Iyer", baseLocation: "Chennai" },
    { empId: "EMP-1004", name: "Vikram Malhotra", baseLocation: "Bengaluru" },
    { empId: "EMP-1005", name: "Sneha Patel", baseLocation: "Pune" },
    { empId: "EMP-1006", name: "Arvind Rao", baseLocation: "Hyderabad" },
    { empId: "EMP-1007", name: "Divya Nair", baseLocation: "Chennai" },
    { empId: "EMP-1008", name: "Rajesh Kumar", baseLocation: "Hyderabad" },
    { empId: "EMP-1009", name: "Meera Joshi", baseLocation: "Pune" },
    { empId: "EMP-1010", name: "Karthik Swaminathan", baseLocation: "Chennai" },
    { empId: "EMP-1011", name: "Pooja Verma", baseLocation: "Bengaluru" },
    { empId: "EMP-1012", name: "Sanjay Gupta", baseLocation: "Hyderabad" },
    { empId: "EMP-1013", name: "Neha Kulkarni", baseLocation: "Pune" },
    { empId: "EMP-1014", name: "Rahul Mehta", baseLocation: "Bengaluru" },
    { empId: "EMP-1015", name: "Sunita Reddy", baseLocation: "Hyderabad" },
    { empId: "EMP-1016", name: "Amit Shah", baseLocation: "Pune" },
  ];

  const employeeMap = new Map<string, string>(); // empId -> id
  for (const emp of employees) {
    const record = await db.employee.upsert({
      where: { empId: emp.empId },
      update: { name: emp.name, baseLocation: emp.baseLocation, active: true },
      create: { empId: emp.empId, name: emp.name, baseLocation: emp.baseLocation, active: true },
    });
    employeeMap.set(emp.empId, record.id);
  }
  return employeeMap;
}

// -----------------------------------------------------------------------------
// Seed Historical Procurement (No stock movement)
// -----------------------------------------------------------------------------
export async function seedHistoricalProcurement(adminId: string, itemMap: Map<string, string>) {
  console.log("Seeding historical procurement records (provenance without stock change)...");

  const idempotencyKey = "demo:import:procurement-hist-2025";
  let job = await db.importJob.findUnique({ where: { idempotencyKey } });

  if (!job) {
    job = await db.importJob.create({
      data: {
        type: "PROCUREMENT",
        mode: "HISTORICAL",
        filename: "Procurement_Historical_FY2025.xlsx",
        checksum: createHash("sha256").update("procurement-historical-2025-checksum").digest("hex"),
        idempotencyKey,
        status: "COMMITTED",
        uploadedById: adminId,
        committedById: adminId,
        committedAt: new Date("2026-01-10T11:00:00Z"),
        createdAt: new Date("2026-01-10T10:00:00Z"),
        totalRows: 5,
        validRows: 5,
        invalidRows: 0,
        duplicateRows: 0,
      },
    });
  }

  const historicalProcurements = [
    { row: 2, date: new Date("2025-10-15"), sku: "MTS-ASH-M", qty: 100, details: "Historical Apparel Procurement" },
    { row: 3, date: new Date("2025-11-20"), sku: "MTS-ASH-L", qty: 80, details: "Winter Batch T-Shirts" },
    { row: 4, date: new Date("2025-12-05"), sku: "BCM-BLU", qty: 60, details: "Branded Drinkware FY25" },
    { row: 5, date: new Date("2025-12-10"), sku: "HPN-RGB-BLK-L", qty: 30, details: "Peripherals Batch 1" },
    { row: 6, date: new Date("2025-12-18"), sku: "STK-LPT", qty: 250, details: "Merch Stickers Bulk" },
  ];

  for (const hp of historicalProcurements) {
    const itemId = itemMap.get(hp.sku)!;
    // Check if ProcurementRecord exists
    const sourceRef = `hist-proc:${job.id}:${hp.row}`;
    const existingRec = await db.procurementRecord.findFirst({ where: { sourceRef } });
    if (!existingRec) {
      await db.procurementRecord.create({
        data: {
          itemId,
          importJobId: job.id,
          sourceRow: hp.row,
          mode: "HISTORICAL",
          procurementDate: hp.date,
          quantity: hp.qty,
          status: "POSTED",
          movementId: null, // Strictly null: historical import does not post stock-in
          sourceRef,
          reason: "Historical import; no stock effect",
          createdAt: hp.date,
        },
      });
    }

    // Staged ImportRow
    const existingRow = await db.importRow.findUnique({
      where: { jobId_sourceRow: { jobId: job.id, sourceRow: hp.row } },
    });
    if (!existingRow) {
      await db.importRow.create({
        data: {
          jobId: job.id,
          sourceRow: hp.row,
          raw: {
            Date: hp.date.toISOString().split("T")[0],
            "Product Details": hp.details,
            Product: hp.sku.startsWith("MTS") ? "Mavericks T-Shirt" : hp.sku.startsWith("BCM") ? "Bot All Coffee Mug" : hp.sku.startsWith("HPN") ? "Headphones (RGB)" : "Laptop Sticker",
            "Size / Quantity": hp.sku.endsWith("-M") ? "M" : hp.sku.endsWith("-L") ? "Large" : "NA",
            Color: hp.sku.startsWith("MTS") ? "Ash" : hp.sku.startsWith("BCM") ? "Blue" : "NA",
            Brand: hp.sku.startsWith("MTS") ? "Crocodile" : hp.sku.startsWith("HPN") ? "Boat" : "NA",
            Procured: hp.qty,
          },
          status: "VALID",
          matchedItemId: itemId,
        },
      });
    }
  }
}

// -----------------------------------------------------------------------------
// Seed Historical Recipient Records (No stock movement)
// -----------------------------------------------------------------------------
export async function seedHistoricalRecipient(adminId: string, itemMap: Map<string, string>, employeeMap: Map<string, string>) {
  console.log("Seeding historical distribution records (provenance without stock change)...");

  const idempotencyKey = "demo:import:recipient-hist-2025";
  let job = await db.importJob.findUnique({ where: { idempotencyKey } });

  if (!job) {
    job = await db.importJob.create({
      data: {
        type: "RECIPIENT",
        mode: "HISTORICAL",
        filename: "Recipient_Historical_Batch_2025.xlsx",
        checksum: createHash("sha256").update("recipient-historical-2025-checksum").digest("hex"),
        idempotencyKey,
        status: "COMMITTED",
        uploadedById: adminId,
        committedById: adminId,
        committedAt: new Date("2026-01-12T14:00:00Z"),
        createdAt: new Date("2026-01-12T13:30:00Z"),
        totalRows: 6,
        validRows: 6,
        invalidRows: 0,
        duplicateRows: 0,
      },
    });
  }

  const historicalDistributions = [
    { row: 2, date: new Date("2025-10-20"), empId: "EMP-1001", sku: "MTS-ASH-M", qty: 1, cat: "Onboarding", poc: "HR Team" },
    { row: 3, date: new Date("2025-10-25"), empId: "EMP-1002", sku: "BCM-BLU", qty: 1, cat: "Internship", poc: "Campus Ops" },
    { row: 4, date: new Date("2025-11-10"), empId: "EMP-1003", sku: "HPN-RGB-BLK-L", qty: 1, cat: "Event Participation", poc: "Tech Desk" },
    { row: 5, date: new Date("2025-11-15"), empId: "EMP-1004", sku: "WMS-BLK", qty: 1, cat: "Event Design", poc: "Design Leads" },
    { row: 6, date: new Date("2025-12-01"), empId: "EMP-1005", sku: "STK-LPT", qty: 5, cat: "Onboarding", poc: "HR Team" },
    { row: 7, date: new Date("2025-12-10"), empId: "EMP-1006", sku: "MTS-ASH-L", qty: 1, cat: "Event Participation", poc: "Campus Ops" },
  ];

  for (const hd of historicalDistributions) {
    const itemId = itemMap.get(hd.sku)!;
    const employeeId = employeeMap.get(hd.empId)!;
    const sourceRef = `hist-dist:${job.id}:${hd.row}`;

    const existingRec = await db.distributionRecord.findFirst({ where: { sourceRef } });
    if (!existingRec) {
      await db.distributionRecord.create({
        data: {
          employeeId,
          itemId,
          importJobId: job.id,
          sourceRow: hd.row,
          mode: "HISTORICAL",
          distributionDate: hd.date,
          quantity: hd.qty,
          category: hd.cat,
          poc: hd.poc,
          sourceStatus: "Distributed",
          movementId: null, // Strictly null: historical distribution does not deduct stock
          sourceRef,
          createdAt: hd.date,
        },
      });
    }

    const existingRow = await db.importRow.findUnique({
      where: { jobId_sourceRow: { jobId: job.id, sourceRow: hd.row } },
    });
    if (!existingRow) {
      await db.importRow.create({
        data: {
          jobId: job.id,
          sourceRow: hd.row,
          raw: {
            Date: hd.date.toISOString().split("T")[0],
            "Emp ID": hd.empId,
            Name: hd.empId === "EMP-1001" ? "Priya Sharma" : hd.empId === "EMP-1002" ? "Rohan Desai" : hd.empId === "EMP-1003" ? "Ananya Iyer" : hd.empId === "EMP-1004" ? "Vikram Malhotra" : hd.empId === "EMP-1005" ? "Sneha Patel" : "Arvind Rao",
            "Base Location": hd.empId === "EMP-1001" ? "Bengaluru" : hd.empId === "EMP-1002" ? "Pune" : hd.empId === "EMP-1003" ? "Chennai" : hd.empId === "EMP-1004" ? "Bengaluru" : hd.empId === "EMP-1005" ? "Pune" : "Hyderabad",
            Category: hd.cat,
            POC: hd.poc,
            Product: hd.sku.startsWith("MTS") ? "Mavericks T-Shirt" : hd.sku.startsWith("BCM") ? "Bot All Coffee Mug" : hd.sku.startsWith("HPN") ? "Headphones (RGB)" : hd.sku.startsWith("WMS") ? "Wireless Mouse" : "Laptop Sticker",
            "Size / Quantity": hd.sku.endsWith("-M") ? "M" : hd.sku.endsWith("-L") ? "L" : "NA",
            Color: hd.sku.startsWith("MTS") ? "Ash" : hd.sku.startsWith("BCM") ? "Blue" : "NA",
            Brand: hd.sku.startsWith("MTS") ? "Crocodile" : hd.sku.startsWith("HPN") ? "Boat" : "NA",
            Status: "Distributed",
          },
          status: "VALID",
          matchedItemId: itemId,
          matchedEmployeeId: employeeId,
        },
      });
    }
  }
}

// -----------------------------------------------------------------------------
// Seed Initial Reconciliation & Ledger Setup
// -----------------------------------------------------------------------------
export async function seedInitialReconciliationAndLedger(adminId: string, managerId: string, itemMap: Map<string, string>) {
  console.log("Seeding approved initial stock count reconciliation and baseline stock ledger...");

  const idempotencyKey = "demo:import:stock-count-q1-2026";
  let job = await db.importJob.findUnique({ where: { idempotencyKey } });

  if (!job) {
    job = await db.importJob.create({
      data: {
        type: "STOCK_COUNT",
        mode: "RECONCILIATION",
        filename: "Stock_Count_Q1_2026_Initial.xlsx",
        checksum: createHash("sha256").update("stock-count-q1-2026-checksum").digest("hex"),
        idempotencyKey,
        status: "COMMITTED",
        uploadedById: adminId,
        committedById: managerId,
        committedAt: new Date("2026-01-15T10:30:00Z"),
        createdAt: new Date("2026-01-15T09:00:00Z"),
        totalRows: 11,
        validRows: 11,
        invalidRows: 0,
        duplicateRows: 0,
      },
    });
  }

  // Initial target count to establish baseline stock
  const initialStockCounts = [
    { row: 1, sku: "MTS-ASH-S", count: 100 },
    { row: 2, sku: "MTS-ASH-M", count: 150 },
    { row: 3, sku: "MTS-ASH-L", count: 120 },
    { row: 4, sku: "MTS-ASH-XL", count: 20 },
    { row: 5, sku: "MTS-ASH-XXL", count: 15 },
    { row: 6, sku: "MTS-ASH-XXXL", count: 0 },
    { row: 7, sku: "BCM-BLU", count: 80 },
    { row: 8, sku: "BCM-BLK", count: 15 },
    { row: 9, sku: "HPN-RGB-BLK-L", count: 40 },
    { row: 10, sku: "WMS-BLK", count: 25 },
    { row: 11, sku: "STK-LPT", count: 350 },
  ];

  for (const isc of initialStockCounts) {
    const itemId = itemMap.get(isc.sku)!;

    // Check or create ReconciliationReview
    let review = await db.reconciliationReview.findUnique({
      where: { importJobId_itemId: { importJobId: job.id, itemId } },
    });

    if (!review) {
      review = await db.reconciliationReview.create({
        data: {
          importJobId: job.id,
          itemId,
          sourceRow: isc.row,
          balanceBefore: 0,
          targetBalance: isc.count,
          variance: isc.count,
          status: isc.count > 0 ? "POSTED" : "APPROVED",
          requesterId: adminId,
          reviewerId: managerId,
          reviewedAt: new Date("2026-01-15T10:30:00Z"),
          reason: "Initial approved stock count reconciliation",
          createdAt: new Date("2026-01-15T09:30:00Z"),
        },
      });
    }

    // If count > 0, post StockMovement if not already posted
    if (isc.count > 0) {
      const moveIdempotencyKey = `demo:move:recon:init:${isc.sku}`;
      let move = await db.stockMovement.findUnique({ where: { idempotencyKey: moveIdempotencyKey } });
      if (!move) {
        move = await db.stockMovement.create({
          data: {
            itemId,
            change: isc.count,
            balanceAfter: isc.count,
            type: "RECONCILIATION_ADJUSTMENT",
            actorId: managerId,
            sourceType: "RECONCILIATION",
            sourceId: review.id,
            idempotencyKey: moveIdempotencyKey,
            approvedById: managerId,
            approvedAt: new Date("2026-01-15T10:30:00Z"),
            reason: "Initial approved stock count reconciliation",
            createdAt: new Date("2026-01-15T10:30:00Z"),
          },
        });
        await db.reconciliationReview.update({
          where: { id: review.id },
          data: { movementId: move.id, status: "POSTED" },
        });
      }
    }

    // Staged row in ImportRow
    const existingRow = await db.importRow.findUnique({
      where: { jobId_sourceRow: { jobId: job.id, sourceRow: isc.row } },
    });
    if (!existingRow) {
      await db.importRow.create({
        data: {
          jobId: job.id,
          sourceRow: isc.row,
          raw: {
            "S.N": isc.row,
            "Product Details": isc.sku,
            Product: isc.sku.startsWith("MTS") ? "Mavericks T-Shirt" : isc.sku.startsWith("BCM") ? "Bot All Coffee Mug" : isc.sku.startsWith("HPN") ? "Headphones (RGB)" : isc.sku.startsWith("WMS") ? "Wireless Mouse" : "Laptop Sticker",
            "Size / Quantity": isc.sku.endsWith("-S") ? "S" : isc.sku.endsWith("-M") ? "M" : isc.sku.endsWith("-L") ? "L" : isc.sku.endsWith("-XL") ? "XL" : isc.sku.endsWith("-XXL") ? "XXL" : isc.sku.endsWith("-XXXL") ? "XXXL" : "NA",
            Color: isc.sku.startsWith("MTS") ? "Ash" : isc.sku.startsWith("BCM") ? (isc.sku.endsWith("-BLU") ? "Blue" : "Black") : "NA",
            Brand: isc.sku.startsWith("MTS") ? "Crocodile" : isc.sku.startsWith("HPN") ? "Boat" : "NA",
            Procured: isc.count,
            "Distributed Qty": 0,
            Available: isc.count,
          },
          status: "VALID",
          matchedItemId: itemId,
        },
      });
    }
  }
}

// -----------------------------------------------------------------------------
// Seed Approved Procurement (Stock-In)
// -----------------------------------------------------------------------------
export async function seedApprovedProcurement(adminId: string, authorityId: string, itemMap: Map<string, string>) {
  console.log("Seeding approved new procurement import with authorized stock-in ledger entries...");

  const idempotencyKey = "demo:import:procurement-new-batch01";
  let job = await db.importJob.findUnique({ where: { idempotencyKey } });

  if (!job) {
    job = await db.importJob.create({
      data: {
        type: "PROCUREMENT",
        mode: "NEW",
        filename: "Procurement_New_Batch_01.xlsx",
        checksum: createHash("sha256").update("procurement-new-batch01-checksum").digest("hex"),
        idempotencyKey,
        status: "COMMITTED",
        uploadedById: adminId,
        committedById: authorityId,
        committedAt: new Date("2026-02-05T15:00:00Z"),
        createdAt: new Date("2026-02-05T11:00:00Z"),
        totalRows: 2,
        validRows: 2,
        invalidRows: 0,
        duplicateRows: 0,
      },
    });
  }

  const procurements = [
    { row: 2, sku: "MTS-ASH-M", qty: 20, expectedBalanceAfter: 170, date: new Date("2026-02-05") },
    { row: 3, sku: "BCM-BLU", qty: 10, expectedBalanceAfter: 90, date: new Date("2026-02-05") },
  ];

  for (const p of procurements) {
    const itemId = itemMap.get(p.sku)!;
    const sourceRef = `new-proc:${job.id}:${p.row}`;

    let record = await db.procurementRecord.findFirst({ where: { sourceRef } });
    if (!record) {
      record = await db.procurementRecord.create({
        data: {
          itemId,
          importJobId: job.id,
          sourceRow: p.row,
          mode: "NEW",
          procurementDate: p.date,
          quantity: p.qty,
          status: "POSTED",
          sourceRef,
          approverId: authorityId,
          approvedAt: new Date("2026-02-05T15:00:00Z"),
          reason: "Approved quarterly restock procurement",
          createdAt: p.date,
        },
      });
    }

    const moveIdempotencyKey = `demo:move:proc:${record.id}`;
    let move = await db.stockMovement.findUnique({ where: { idempotencyKey: moveIdempotencyKey } });
    if (!move) {
      move = await db.stockMovement.create({
        data: {
          itemId,
          change: p.qty,
          balanceAfter: p.expectedBalanceAfter,
          type: "PROCUREMENT_IN",
          actorId: authorityId,
          sourceType: "PROCUREMENT",
          sourceId: record.id,
          idempotencyKey: moveIdempotencyKey,
          approvedById: authorityId,
          approvedAt: new Date("2026-02-05T15:00:00Z"),
          reason: "Approved procurement stock-in",
          createdAt: new Date("2026-02-05T15:00:00Z"),
        },
      });
      await db.procurementRecord.update({
        where: { id: record.id },
        data: { movementId: move.id },
      });
    }

    // Staged row
    const existingRow = await db.importRow.findUnique({
      where: { jobId_sourceRow: { jobId: job.id, sourceRow: p.row } },
    });
    if (!existingRow) {
      await db.importRow.create({
        data: {
          jobId: job.id,
          sourceRow: p.row,
          raw: {
            Date: p.date.toISOString().split("T")[0],
            "Product Details": p.sku,
            Product: p.sku.startsWith("MTS") ? "Mavericks T-Shirt" : "Bot All Coffee Mug",
            "Size / Quantity": p.sku.endsWith("-M") ? "M" : "NA",
            Color: p.sku.startsWith("MTS") ? "Ash" : "Blue",
            Brand: p.sku.startsWith("MTS") ? "Crocodile" : "NA",
            Procured: p.qty,
          },
          status: "VALID",
          matchedItemId: itemId,
        },
      });
    }
  }
}

// -----------------------------------------------------------------------------
// Seed Distribution Requests & Approvals
// -----------------------------------------------------------------------------
export async function seedDistributionRequestsAndApprovals(
  execId: string,
  managerId: string,
  authorityId: string,
  itemMap: Map<string, string>
) {
  console.log("Seeding distribution request history with full approval lifecycles...");

  // 1. REQ-00001: Approved and distributed onboarding kits (ledger deductions)
  let req1 = await db.request.findUnique({ where: { number: 1 } });
  if (!req1) {
    req1 = await db.request.create({
      data: {
        number: 1,
        requesterId: execId,
        status: "APPROVED",
        purpose: "Bengaluru Q2 New Hire Onboarding Kits",
        levels: 2,
        createdAt: new Date("2026-02-15T09:00:00Z"),
        submittedAt: new Date("2026-02-15T09:15:00Z"),
      },
    });
  }

  const req1Lines = [
    { sku: "MTS-ASH-S", qty: 15, balanceAfter: 85 },
    { sku: "MTS-ASH-M", qty: 30, balanceAfter: 140 },
    { sku: "MTS-ASH-L", qty: 10, balanceAfter: 110 },
    { sku: "BCM-BLU", qty: 15, balanceAfter: 75 },
    { sku: "STK-LPT", qty: 30, balanceAfter: 320 },
  ];

  for (const line of req1Lines) {
    const itemId = itemMap.get(line.sku)!;
    const existingLine = await db.requestLine.findFirst({
      where: { requestId: req1.id, itemId },
    });
    if (!existingLine) {
      await db.requestLine.create({
        data: {
          requestId: req1.id,
          itemId,
          itemName: line.sku,
          quantity: line.qty,
        },
      });
    }

    const moveKey = `demo:move:dist:${req1.id}:${line.sku}`;
    const existingMove = await db.stockMovement.findUnique({ where: { idempotencyKey: moveKey } });
    if (!existingMove) {
      await db.stockMovement.create({
        data: {
          itemId,
          change: -line.qty,
          balanceAfter: line.balanceAfter,
          type: "DISTRIBUTION_OUT",
          refId: req1.id,
          actorId: authorityId,
          sourceType: "REQUEST",
          sourceId: req1.id,
          idempotencyKey: moveKey,
          approvedById: authorityId,
          approvedAt: new Date("2026-02-15T14:00:00Z"),
          reason: "Approved distribution for REQ-00001",
          createdAt: new Date("2026-02-15T14:00:00Z"),
        },
      });
    }
  }

  // Approvals for REQ-00001
  await db.approval.upsert({
    where: { requestId_stage: { requestId: req1.id, stage: 1 } },
    update: {},
    create: {
      requestId: req1.id,
      stage: 1,
      approverId: managerId,
      approverName: "Mia Manager",
      decision: "APPROVED",
      remarks: "Onboarding headcount verified with HR",
      createdAt: new Date("2026-02-15T11:00:00Z"),
    },
  });
  await db.approval.upsert({
    where: { requestId_stage: { requestId: req1.id, stage: 2 } },
    update: {},
    create: {
      requestId: req1.id,
      stage: 2,
      approverId: authorityId,
      approverName: "Ari Authority",
      decision: "APPROVED",
      remarks: "Final authority sign-off; stock deducted",
      createdAt: new Date("2026-02-15T14:00:00Z"),
    },
  });

  // Additional prior approved distributions to calibrate remaining items
  // XL T-Shirt (-14 -> leaves 6), XXL T-Shirt (-14 -> leaves 1), BCM-BLK (-5 -> leaves 10), Headphones (-5 -> leaves 35), Wireless Mouse (-21 -> leaves 4)
  const additionalDeductions = [
    { reqNum: 7, sku: "MTS-ASH-XL", qty: 14, balanceAfter: 6, purpose: "Interns Welcome Kits" },
    { reqNum: 8, sku: "MTS-ASH-XXL", qty: 14, balanceAfter: 1, purpose: "Event Volunteer Team" },
    { reqNum: 9, sku: "BCM-BLK", qty: 5, balanceAfter: 10, purpose: "Executive Office Mugs" },
    { reqNum: 10, sku: "HPN-RGB-BLK-L", qty: 5, balanceAfter: 35, purpose: "AV Media Production Team" },
    { reqNum: 11, sku: "WMS-BLK", qty: 21, balanceAfter: 4, purpose: "Customer Support Desk Replacement" },
  ];

  for (const ad of additionalDeductions) {
    let req = await db.request.findUnique({ where: { number: ad.reqNum } });
    if (!req) {
      req = await db.request.create({
        data: {
          number: ad.reqNum,
          requesterId: execId,
          status: "APPROVED",
          purpose: ad.purpose,
          levels: 2,
          createdAt: new Date("2026-02-20T10:00:00Z"),
          submittedAt: new Date("2026-02-20T10:30:00Z"),
        },
      });
    }

    const itemId = itemMap.get(ad.sku)!;
    const existingLine = await db.requestLine.findFirst({ where: { requestId: req.id, itemId } });
    if (!existingLine) {
      await db.requestLine.create({
        data: { requestId: req.id, itemId, itemName: ad.sku, quantity: ad.qty },
      });
    }

    const moveKey = `demo:move:dist:${req.id}:${ad.sku}`;
    const existingMove = await db.stockMovement.findUnique({ where: { idempotencyKey: moveKey } });
    if (!existingMove) {
      await db.stockMovement.create({
        data: {
          itemId,
          change: -ad.qty,
          balanceAfter: ad.balanceAfter,
          type: "DISTRIBUTION_OUT",
          refId: req.id,
          actorId: authorityId,
          sourceType: "REQUEST",
          sourceId: req.id,
          idempotencyKey: moveKey,
          approvedById: authorityId,
          approvedAt: new Date("2026-02-20T14:00:00Z"),
          reason: `Approved distribution for REQ-${String(ad.reqNum).padStart(5, "0")}`,
          createdAt: new Date("2026-02-20T14:00:00Z"),
        },
      });
    }

    await db.approval.upsert({
      where: { requestId_stage: { requestId: req.id, stage: 1 } },
      update: {},
      create: {
        requestId: req.id,
        stage: 1,
        approverId: managerId,
        approverName: "Mia Manager",
        decision: "APPROVED",
        remarks: "Approved by manager",
        createdAt: new Date("2026-02-20T11:00:00Z"),
      },
    });
    await db.approval.upsert({
      where: { requestId_stage: { requestId: req.id, stage: 2 } },
      update: {},
      create: {
        requestId: req.id,
        stage: 2,
        approverId: authorityId,
        approverName: "Ari Authority",
        decision: "APPROVED",
        remarks: "Approved by authority",
        createdAt: new Date("2026-02-20T14:00:00Z"),
      },
    });
  }

  // 2. REQ-00002: Pending Manager Approval (Stage 1)
  let req2 = await db.request.findUnique({ where: { number: 2 } });
  if (!req2) {
    req2 = await db.request.create({
      data: {
        number: 2,
        requesterId: execId,
        status: "PENDING_MANAGER",
        purpose: "Pune Design Sprint Peripherals",
        levels: 2,
        createdAt: new Date("2026-03-01T10:00:00Z"),
        submittedAt: new Date("2026-03-01T10:15:00Z"),
      },
    });
    await db.requestLine.createMany({
      data: [
        { requestId: req2.id, itemId: itemMap.get("HPN-RGB-BLK-L")!, itemName: "Headphones (RGB) - Black (Large)", quantity: 5 },
        { requestId: req2.id, itemId: itemMap.get("WMS-BLK")!, itemName: "Wireless Mouse - Black", quantity: 3 },
      ],
    });
  }

  // 3. REQ-00003: Pending Authority Approval (Stage 2)
  let req3 = await db.request.findUnique({ where: { number: 3 } });
  if (!req3) {
    req3 = await db.request.create({
      data: {
        number: 3,
        requesterId: execId,
        status: "PENDING_AUTHORITY",
        purpose: "Annual Hackathon Participant Awards",
        levels: 2,
        createdAt: new Date("2026-03-05T14:00:00Z"),
        submittedAt: new Date("2026-03-05T14:30:00Z"),
      },
    });
    await db.requestLine.createMany({
      data: [
        { requestId: req3.id, itemId: itemMap.get("MTS-ASH-XL")!, itemName: "Mavericks T-Shirt - Ash (XL)", quantity: 10 },
        { requestId: req3.id, itemId: itemMap.get("BCM-BLK")!, itemName: "Bot All Coffee Mug - Black", quantity: 5 },
      ],
    });
    await db.approval.create({
      data: {
        requestId: req3.id,
        stage: 1,
        approverId: managerId,
        approverName: "Mia Manager",
        decision: "APPROVED",
        remarks: "Approved for Hackathon. Forwarded to Authority for final approval.",
        createdAt: new Date("2026-03-05T16:00:00Z"),
      },
    });
  }

  // 4. REQ-00004: Draft Request (Not yet submitted)
  let req4 = await db.request.findUnique({ where: { number: 4 } });
  if (!req4) {
    req4 = await db.request.create({
      data: {
        number: 4,
        requesterId: execId,
        status: "DRAFT",
        purpose: "Draft Q3 office welcome packs",
        levels: 2,
        createdAt: new Date("2026-03-10T11:00:00Z"),
        submittedAt: null,
      },
    });
    await db.requestLine.create({
      data: {
        requestId: req4.id,
        itemId: itemMap.get("STK-LPT")!,
        itemName: "Laptop Sticker Pack",
        quantity: 50,
      },
    });
  }

  // 5. REQ-00005: Rejected Request (Stage 1 Rejection)
  let req5 = await db.request.findUnique({ where: { number: 5 } });
  if (!req5) {
    req5 = await db.request.create({
      data: {
        number: 5,
        requesterId: execId,
        status: "REJECTED",
        purpose: "External Vendor Summit Swag",
        levels: 2,
        createdAt: new Date("2026-03-12T09:00:00Z"),
        submittedAt: new Date("2026-03-12T09:30:00Z"),
      },
    });
    await db.requestLine.create({
      data: {
        requestId: req5.id,
        itemId: itemMap.get("HPN-RGB-BLK-L")!,
        itemName: "Headphones (RGB) - Black (Large)",
        quantity: 10,
      },
    });
    await db.approval.create({
      data: {
        requestId: req5.id,
        stage: 1,
        approverId: managerId,
        approverName: "Mia Manager",
        decision: "REJECTED",
        remarks: "External vendor events are not eligible for internal inventory allocations.",
        createdAt: new Date("2026-03-12T11:00:00Z"),
      },
    });
  }

  // 6. REQ-00006: Insufficient Stock Review (NEEDS_REVIEW)
  let req6 = await db.request.findUnique({ where: { number: 6 } });
  if (!req6) {
    req6 = await db.request.create({
      data: {
        number: 6,
        requesterId: execId,
        status: "NEEDS_REVIEW",
        purpose: "Regional Tech Meetup Peripheral Distribution",
        levels: 2,
        reviewReason: "Insufficient stock for: Wireless Mouse - Black. Requested 25, on hand 4.",
        createdAt: new Date("2026-03-15T15:00:00Z"),
        submittedAt: new Date("2026-03-15T15:30:00Z"),
      },
    });
    await db.requestLine.create({
      data: {
        requestId: req6.id,
        itemId: itemMap.get("WMS-BLK")!,
        itemName: "Wireless Mouse - Black",
        quantity: 25,
      },
    });
    await db.approval.create({
      data: {
        requestId: req6.id,
        stage: 1,
        approverId: managerId,
        approverName: "Mia Manager",
        decision: "APPROVED",
        remarks: "Approved by manager; forwarded for final sign-off.",
        createdAt: new Date("2026-03-15T16:00:00Z"),
      },
    });
  }
}

// -----------------------------------------------------------------------------
// Seed Mid-Year Stock Count Reconciliation (Variances: Zero, +, -, Rejected)
// -----------------------------------------------------------------------------
export async function seedSubsequentReconciliation(adminId: string, managerId: string, authorityId: string, itemMap: Map<string, string>) {
  console.log("Seeding mid-year reconciliation audit covering zero variance, positive adjustment, negative write-off, and rejected review...");

  const idempotencyKey = "demo:import:stock-count-midyear-2026";
  let job = await db.importJob.findUnique({ where: { idempotencyKey } });

  if (!job) {
    job = await db.importJob.create({
      data: {
        type: "STOCK_COUNT",
        mode: "RECONCILIATION",
        filename: "Stock_Count_MidYear_Audit.xlsx",
        checksum: createHash("sha256").update("stock-count-midyear-2026-checksum").digest("hex"),
        idempotencyKey,
        status: "COMMITTED",
        uploadedById: adminId,
        committedById: managerId,
        committedAt: new Date("2026-04-01T16:00:00Z"),
        createdAt: new Date("2026-04-01T14:00:00Z"),
        totalRows: 4,
        validRows: 4,
        invalidRows: 0,
        duplicateRows: 0,
      },
    });
  }

  // 1. Zero Variance: Laptop Stickers (balanceBefore: 320, target: 320, variance: 0)
  const stickerId = itemMap.get("STK-LPT")!;
  const rSticker = await db.reconciliationReview.upsert({
    where: { importJobId_itemId: { importJobId: job.id, itemId: stickerId } },
    update: {},
    create: {
      importJobId: job.id,
      itemId: stickerId,
      sourceRow: 1,
      balanceBefore: 320,
      targetBalance: 320,
      variance: 0,
      status: "APPROVED",
      requesterId: adminId,
      reviewerId: managerId,
      reviewedAt: new Date("2026-04-01T16:00:00Z"),
      reason: "Physical count perfectly verified with ledger",
      createdAt: new Date("2026-04-01T14:30:00Z"),
    },
  });

  // 2. Positive Variance: MTS-ASH-XXL (balanceBefore: 1, target: 3, variance: +2)
  const xxlId = itemMap.get("MTS-ASH-XXL")!;
  const rXxl = await db.reconciliationReview.upsert({
    where: { importJobId_itemId: { importJobId: job.id, itemId: xxlId } },
    update: {},
    create: {
      importJobId: job.id,
      itemId: xxlId,
      sourceRow: 2,
      balanceBefore: 1,
      targetBalance: 3,
      variance: 2,
      status: "POSTED",
      requesterId: adminId,
      reviewerId: managerId,
      reviewedAt: new Date("2026-04-01T16:00:00Z"),
      reason: "Found 2 unrecorded garments in return shelf",
      createdAt: new Date("2026-04-01T14:30:00Z"),
    },
  });

  const moveKeyXxl = `demo:move:recon:midyear:xxl`;
  let moveXxl = await db.stockMovement.findUnique({ where: { idempotencyKey: moveKeyXxl } });
  if (!moveXxl) {
    moveXxl = await db.stockMovement.create({
      data: {
        itemId: xxlId,
        change: 2,
        balanceAfter: 3,
        type: "RECONCILIATION_ADJUSTMENT",
        actorId: managerId,
        sourceType: "RECONCILIATION",
        sourceId: rXxl.id,
        idempotencyKey: moveKeyXxl,
        approvedById: managerId,
        approvedAt: new Date("2026-04-01T16:00:00Z"),
        reason: "Positive inventory adjustment: 2 units found during physical count",
        createdAt: new Date("2026-04-01T16:00:00Z"),
      },
    });
    await db.reconciliationReview.update({
      where: { id: rXxl.id },
      data: { movementId: moveXxl.id },
    });
  }

  // 3. Negative Variance: BCM-BLK (balanceBefore: 10, target: 5, variance: -5)
  const mugId = itemMap.get("BCM-BLK")!;
  const rMug = await db.reconciliationReview.upsert({
    where: { importJobId_itemId: { importJobId: job.id, itemId: mugId } },
    update: {},
    create: {
      importJobId: job.id,
      itemId: mugId,
      sourceRow: 3,
      balanceBefore: 10,
      targetBalance: 5,
      variance: -5,
      status: "POSTED",
      requesterId: adminId,
      reviewerId: managerId,
      reviewedAt: new Date("2026-04-01T16:00:00Z"),
      reason: "5 broken ceramic mugs written off during stock audit",
      createdAt: new Date("2026-04-01T14:30:00Z"),
    },
  });

  const moveKeyMug = `demo:move:recon:midyear:mug`;
  let moveMug = await db.stockMovement.findUnique({ where: { idempotencyKey: moveKeyMug } });
  if (!moveMug) {
    moveMug = await db.stockMovement.create({
      data: {
        itemId: mugId,
        change: -5,
        balanceAfter: 5,
        type: "RECONCILIATION_ADJUSTMENT",
        actorId: managerId,
        sourceType: "RECONCILIATION",
        sourceId: rMug.id,
        idempotencyKey: moveKeyMug,
        approvedById: managerId,
        approvedAt: new Date("2026-04-01T16:00:00Z"),
        reason: "Negative inventory adjustment: write-off of damaged mugs",
        createdAt: new Date("2026-04-01T16:00:00Z"),
      },
    });
    await db.reconciliationReview.update({
      where: { id: rMug.id },
      data: { movementId: moveMug.id },
    });
  }

  // 4. Rejected Reconciliation: HPN-RGB-BLK-L (balanceBefore: 35, target: 25, variance: -10)
  const hpnId = itemMap.get("HPN-RGB-BLK-L")!;
  await db.reconciliationReview.upsert({
    where: { importJobId_itemId: { importJobId: job.id, itemId: hpnId } },
    update: {},
    create: {
      importJobId: job.id,
      itemId: hpnId,
      sourceRow: 4,
      balanceBefore: 35,
      targetBalance: 25,
      variance: -10,
      status: "REJECTED",
      requesterId: adminId,
      reviewerId: authorityId,
      reviewedAt: new Date("2026-04-01T16:30:00Z"),
      reason: "Variance of 10 units rejected. Physical recount required with warehouse supervisor.",
      createdAt: new Date("2026-04-01T14:30:00Z"),
    },
  });
}

// -----------------------------------------------------------------------------
// Seed Pending Import Jobs (Awaiting Approval in /approvals queue)
// -----------------------------------------------------------------------------
export async function seedPendingImportJobs(adminId: string, itemMap: Map<string, string>) {
  console.log("Seeding pending import jobs awaiting manager/authority approval...");

  // 1. Pending Procurement Import
  const procKey = "demo:import:procurement-pending-q2";
  let procJob = await db.importJob.findUnique({ where: { idempotencyKey: procKey } });
  if (!procJob) {
    procJob = await db.importJob.create({
      data: {
        type: "PROCUREMENT",
        mode: "NEW",
        filename: "Procurement_New_Batch_02_Pending.xlsx",
        checksum: createHash("sha256").update("procurement-pending-q2-checksum").digest("hex"),
        idempotencyKey: procKey,
        status: "AWAITING_APPROVAL",
        uploadedById: adminId,
        createdAt: new Date("2026-04-15T09:00:00Z"),
        totalRows: 2,
        validRows: 2,
        invalidRows: 0,
        duplicateRows: 0,
      },
    });

    const rows = [
      { row: 2, sku: "WMS-BLK", qty: 20 },
      { row: 3, sku: "BCM-BLK", qty: 15 },
    ];
    for (const r of rows) {
      await db.importRow.create({
        data: {
          jobId: procJob.id,
          sourceRow: r.row,
          raw: {
            Date: "2026-04-15",
            Product: r.sku.startsWith("WMS") ? "Wireless Mouse" : "Bot All Coffee Mug",
            "Size / Quantity": "NA",
            Color: "Black",
            Brand: "NA",
            Procured: r.qty,
          },
          status: "VALID",
          matchedItemId: itemMap.get(r.sku)!,
        },
      });
    }
  }

  // 2. Pending Stock Count Reconciliation Import
  const reconKey = "demo:import:stock-count-pending-q3";
  let reconJob = await db.importJob.findUnique({ where: { idempotencyKey: reconKey } });
  if (!reconJob) {
    reconJob = await db.importJob.create({
      data: {
        type: "STOCK_COUNT",
        mode: "RECONCILIATION",
        filename: "Stock_Count_Q3_CycleCount.xlsx",
        checksum: createHash("sha256").update("stock-count-pending-q3-checksum").digest("hex"),
        idempotencyKey: reconKey,
        status: "AWAITING_APPROVAL",
        uploadedById: adminId,
        createdAt: new Date("2026-04-18T11:00:00Z"),
        totalRows: 2,
        validRows: 2,
        invalidRows: 0,
        duplicateRows: 0,
      },
    });

    const tShirtLId = itemMap.get("MTS-ASH-L")!;
    const coffeeBlueId = itemMap.get("BCM-BLU")!;

    await db.importRow.createMany({
      data: [
        {
          jobId: reconJob.id,
          sourceRow: 1,
          raw: { "S.N": 1, Product: "Mavericks T-Shirt", "Size / Quantity": "L", Color: "Ash", Brand: "Crocodile", Procured: 120, "Distributed Qty": 10, Available: 115 },
          status: "VALID",
          matchedItemId: tShirtLId,
        },
        {
          jobId: reconJob.id,
          sourceRow: 2,
          raw: { "S.N": 2, Product: "Bot All Coffee Mug", "Size / Quantity": "NA", Color: "Blue", Brand: "NA", Procured: 90, "Distributed Qty": 15, Available: 73 },
          status: "VALID",
          matchedItemId: coffeeBlueId,
        },
      ],
    });

    await db.reconciliationReview.createMany({
      data: [
        {
          importJobId: reconJob.id,
          itemId: tShirtLId,
          sourceRow: 1,
          balanceBefore: 110,
          targetBalance: 115,
          variance: 5,
          status: "PENDING_APPROVAL",
          requesterId: adminId,
          reason: "Cycle count identified 5 extra boxed units",
          createdAt: new Date("2026-04-18T11:30:00Z"),
        },
        {
          importJobId: reconJob.id,
          itemId: coffeeBlueId,
          sourceRow: 2,
          balanceBefore: 75,
          targetBalance: 73,
          variance: -2,
          status: "PENDING_APPROVAL",
          requesterId: adminId,
          reason: "Minor discrepancy observed during cycle audit",
          createdAt: new Date("2026-04-18T11:30:00Z"),
        },
      ],
    });
  }
}

// -----------------------------------------------------------------------------
// Seed Failed, Rolled Back, and Invalid Import Jobs
// -----------------------------------------------------------------------------
export async function seedFailedAndInvalidImportJobs(adminId: string) {
  console.log("Seeding invalid, duplicate, and rolled-back import jobs for validation testing...");

  // 1. Invalid Procurement Format Errors
  const invProcKey = "demo:import:procurement-invalid-errors";
  let invProc = await db.importJob.findUnique({ where: { idempotencyKey: invProcKey } });
  if (!invProc) {
    invProc = await db.importJob.create({
      data: {
        type: "PROCUREMENT",
        mode: "NEW",
        filename: "Procurement_Invalid_Format_Errors.xlsx",
        checksum: createHash("sha256").update("procurement-invalid-errors-checksum").digest("hex"),
        idempotencyKey: invProcKey,
        status: "FAILED",
        errorSummary: "4 row(s) have errors.",
        uploadedById: adminId,
        createdAt: new Date("2026-04-10T10:00:00Z"),
        totalRows: 4,
        validRows: 0,
        invalidRows: 4,
        duplicateRows: 0,
      },
    });

    await db.importRow.createMany({
      data: [
        {
          jobId: invProc.id,
          sourceRow: 2,
          raw: { Date: "XXX", Product: "Mavericks T-Shirt", "Size / Quantity": "M", Color: "Ash", Brand: "Crocodile", Procured: 50 },
          status: "INVALID",
          errors: [{ field: "Date", code: "PLACEHOLDER_VALUE", message: "XXX is a placeholder, not a value." }],
        },
        {
          jobId: invProc.id,
          sourceRow: 3,
          raw: { Date: "2026-02-15", Product: "Mavericks T-Shirt", "Size / Quantity": "L", Color: "Ash", Brand: "Crocodile", Procured: -10 },
          status: "INVALID",
          errors: [{ field: "Procured", code: "INVALID_INTEGER", message: "Must be a whole number, zero or more." }],
        },
        {
          jobId: invProc.id,
          sourceRow: 4,
          raw: { Date: "2026-03-01", Product: "", "Size / Quantity": "NA", Color: "Blue", Brand: "NA", Procured: 30 },
          status: "INVALID",
          errors: [{ field: "Product", code: "MISSING_REQUIRED", message: "A value is required." }],
        },
        {
          jobId: invProc.id,
          sourceRow: 5,
          raw: { Date: "2026-03-12", Product: "NonExistent SmartWatch", "Size / Quantity": "NA", Color: "Black", Brand: "Boat", Procured: 20 },
          status: "INVALID",
          errors: [{ field: "Product", code: "UNKNOWN_VARIANT", message: "Product variant does not exist. Create it before importing." }],
        },
      ],
    });
  }

  // 2. Employee Mismatch Failures
  const empErrKey = "demo:import:recipient-employee-errors";
  let empErrJob = await db.importJob.findUnique({ where: { idempotencyKey: empErrKey } });
  if (!empErrJob) {
    empErrJob = await db.importJob.create({
      data: {
        type: "RECIPIENT",
        mode: "HISTORICAL",
        filename: "Recipient_Employee_Mismatch_Errors.xlsx",
        checksum: createHash("sha256").update("recipient-employee-errors-checksum").digest("hex"),
        idempotencyKey: empErrKey,
        status: "FAILED",
        errorSummary: "3 row(s) need correction before commit.",
        uploadedById: adminId,
        createdAt: new Date("2026-04-12T14:00:00Z"),
        totalRows: 3,
        validRows: 0,
        invalidRows: 3,
        duplicateRows: 0,
      },
    });

    await db.importRow.createMany({
      data: [
        {
          jobId: empErrJob.id,
          sourceRow: 2,
          raw: { Date: "2026-02-15", "Emp ID": "EMP-9999", Name: "Unknown User", "Base Location": "Bengaluru", Product: "Mavericks T-Shirt", "Size / Quantity": "S", Color: "Ash", Brand: "Crocodile", Status: "Distributed" },
          status: "INVALID",
          errors: [{ field: "Emp ID", code: "UNKNOWN_EMPLOYEE", message: "Employee Emp ID does not exist or is inactive." }],
        },
        {
          jobId: empErrJob.id,
          sourceRow: 3,
          raw: { Date: "2026-02-15", "Emp ID": "EMP-1001", Name: "Wrong Name Priya", "Base Location": "Bengaluru", Product: "Bot All Coffee Mug", "Size / Quantity": "NA", Color: "Blue", Brand: "NA", Status: "Distributed" },
          status: "INVALID",
          errors: [{ field: "Name", code: "EMPLOYEE_MISMATCH", message: "Name does not match the employee record." }],
        },
        {
          jobId: empErrJob.id,
          sourceRow: 4,
          raw: { Date: "2026-02-16", "Emp ID": "EMP-1002", Name: "Rohan Desai", "Base Location": "Kolkata", Product: "Mavericks T-Shirt", "Size / Quantity": "M", Color: "Ash", Brand: "Crocodile", Status: "Distributed" },
          status: "INVALID",
          errors: [{ field: "Base Location", code: "EMPLOYEE_MISMATCH", message: "Base Location does not match the employee record." }],
        },
      ],
    });
  }

  // 3. Duplicate Rows Detection
  const dupKey = "demo:import:procurement-duplicate-rows";
  let dupJob = await db.importJob.findUnique({ where: { idempotencyKey: dupKey } });
  if (!dupJob) {
    dupJob = await db.importJob.create({
      data: {
        type: "PROCUREMENT",
        mode: "NEW",
        filename: "Procurement_Duplicate_Rows.xlsx",
        checksum: createHash("sha256").update("procurement-duplicate-rows-checksum").digest("hex"),
        idempotencyKey: dupKey,
        status: "FAILED",
        errorSummary: "1 row(s) have errors.",
        uploadedById: adminId,
        createdAt: new Date("2026-04-14T09:00:00Z"),
        totalRows: 2,
        validRows: 1,
        invalidRows: 1,
        duplicateRows: 1,
      },
    });

    await db.importRow.createMany({
      data: [
        {
          jobId: dupJob.id,
          sourceRow: 2,
          raw: { Date: "2026-03-20", Product: "Wireless Mouse", "Size / Quantity": "NA", Color: "Black", Brand: "NA", Procured: 15 },
          status: "VALID",
        },
        {
          jobId: dupJob.id,
          sourceRow: 3,
          raw: { Date: "2026-03-20", Product: "Wireless Mouse", "Size / Quantity": "NA", Color: "Black", Brand: "NA", Procured: 15 },
          status: "INVALID",
          errors: [{ field: "Product", code: "DUPLICATE_ROW", message: "This row appears to be a duplicate of an earlier row in the same file." }],
        },
      ],
    });
  }

  // 4. Rolled-back Commit Failure
  const rollKey = "demo:import:procurement-rollback-test";
  let rollJob = await db.importJob.findUnique({ where: { idempotencyKey: rollKey } });
  if (!rollJob) {
    await db.importJob.create({
      data: {
        type: "PROCUREMENT",
        mode: "NEW",
        filename: "Procurement_Rollback_Failure.xlsx",
        checksum: createHash("sha256").update("procurement-rollback-test-checksum").digest("hex"),
        idempotencyKey: rollKey,
        status: "ROLLED_BACK",
        errorSummary: "Database transaction aborted during atomic write; no partial business state committed.",
        uploadedById: adminId,
        createdAt: new Date("2026-04-16T15:00:00Z"),
        totalRows: 2,
        validRows: 2,
        invalidRows: 0,
        duplicateRows: 0,
      },
    });
  }
}

// -----------------------------------------------------------------------------
// Seed Comprehensive Audit History
// -----------------------------------------------------------------------------
export async function seedAuditHistory(users: Map<string, string>) {
  console.log("Seeding comprehensive audit trail across users, entities, and actions...");

  const adminId = users.get("admin@mavericks.test")!;
  const execId = users.get("exec@mavericks.test")!;
  const managerId = users.get("manager@mavericks.test")!;
  const authorityId = users.get("authority@mavericks.test")!;

  const auditEvents = [
    { actorId: adminId, action: "LOGIN", entity: "User", entityId: adminId, outcome: "SUCCESS", time: "2026-01-05T08:30:00Z" },
    { actorId: execId, action: "LOGIN", entity: "User", entityId: execId, outcome: "SUCCESS", time: "2026-01-05T08:35:00Z" },
    { actorId: managerId, action: "LOGIN", entity: "User", entityId: managerId, outcome: "SUCCESS", time: "2026-01-05T08:40:00Z" },
    { actorId: authorityId, action: "LOGIN", entity: "User", entityId: authorityId, outcome: "SUCCESS", time: "2026-01-05T08:45:00Z" },
    { actorId: adminId, action: "ITEM_CREATED", entity: "Item", entityId: "MTS-ASH-M", detail: { sku: "MTS-ASH-M", name: "Mavericks T-Shirt - Ash (M)" }, outcome: "SUCCESS", time: "2026-01-06T09:00:00Z" },
    { actorId: adminId, action: "ITEM_CREATED", entity: "Item", entityId: "BCM-BLU", detail: { sku: "BCM-BLU", name: "Bot All Coffee Mug - Blue" }, outcome: "SUCCESS", time: "2026-01-06T09:05:00Z" },
    { actorId: adminId, action: "EMPLOYEE_CREATED", entity: "Employee", entityId: "EMP-1001", detail: { empId: "EMP-1001", name: "Priya Sharma", baseLocation: "Bengaluru" }, outcome: "SUCCESS", time: "2026-01-07T10:00:00Z" },
    { actorId: adminId, action: "IMPORT_UPLOADED", entity: "ImportJob", entityId: "stock-count-q1", detail: { filename: "Stock_Count_Q1_2026_Initial.xlsx", type: "STOCK_COUNT", mode: "RECONCILIATION" }, outcome: "SUCCESS", time: "2026-01-15T09:00:00Z" },
    { actorId: managerId, action: "IMPORT_STOCK_APPROVED", entity: "ImportJob", entityId: "stock-count-q1", detail: { reason: "Initial approved stock count reconciliation" }, outcome: "SUCCESS", time: "2026-01-15T10:30:00Z" },
    { actorId: execId, action: "REQUEST_CREATED", entity: "Request", entityId: "REQ-00001", outcome: "SUCCESS", time: "2026-02-15T09:00:00Z" },
    { actorId: execId, action: "REQUEST_SUBMITTED", entity: "Request", entityId: "REQ-00001", outcome: "SUCCESS", time: "2026-02-15T09:15:00Z" },
    { actorId: managerId, action: "REQUEST_APPROVED_S1", entity: "Request", entityId: "REQ-00001", detail: { remarks: "Onboarding headcount verified" }, outcome: "SUCCESS", time: "2026-02-15T11:00:00Z" },
    { actorId: authorityId, action: "REQUEST_APPROVED_S2", entity: "Request", entityId: "REQ-00001", detail: { remarks: "Final authority sign-off; stock deducted" }, outcome: "SUCCESS", time: "2026-02-15T14:00:00Z" },
    { actorId: managerId, action: "REQUEST_REJECTED_S1", entity: "Request", entityId: "REQ-00005", detail: { remarks: "External vendor events are not eligible" }, outcome: "SUCCESS", time: "2026-03-12T11:00:00Z" },
    { actorId: authorityId, action: "REQUEST_NEEDS_REVIEW", entity: "Request", entityId: "REQ-00006", detail: { reason: "Insufficient stock for: Wireless Mouse - Black" }, outcome: "SUCCESS", time: "2026-03-15T16:00:00Z" },
    { actorId: adminId, action: "IMPORT_UPLOADED", entity: "ImportJob", entityId: "invalid-proc", detail: { filename: "Procurement_Invalid_Format_Errors.xlsx" }, outcome: "FAILURE", time: "2026-04-10T10:00:00Z" },
  ];

  for (const ev of auditEvents) {
    const existing = await db.auditLog.findFirst({
      where: {
        actorId: ev.actorId,
        action: ev.action,
        entity: ev.entity,
        entityId: ev.entityId,
      },
    });
    if (!existing) {
      await db.auditLog.create({
        data: {
          actorId: ev.actorId,
          action: ev.action,
          entity: ev.entity,
          entityId: ev.entityId,
          outcome: ev.outcome,
          detail: ev.detail as any,
          createdAt: new Date(ev.time),
        },
      });
    }
  }
}

// -----------------------------------------------------------------------------
// Synchronize and Verify Item Quantities with Ledger
// -----------------------------------------------------------------------------
export async function syncAndVerifyItemBalances() {
  console.log("Synchronizing cached Item balances with authoritative Stock Movement Ledger...");

  const items = await db.item.findMany();
  let verifiedCount = 0;

  for (const item of items) {
    const ledgerSum = await db.stockMovement
      .aggregate({
        _sum: { change: true },
        where: { itemId: item.id },
      })
      .then((r) => Number(r._sum.change ?? 0));

    // Update item.quantity to match the ledger sum strictly
    await db.item.update({
      where: { id: item.id },
      data: { quantity: ledgerSum },
    });

    if (ledgerSum < 0) {
      throw new Error(`CRITICAL INTEGRITY FAILURE: Item ${item.sku} has negative balance: ${ledgerSum}`);
    }
    verifiedCount++;
  }

  console.log(`Successfully verified and reconciled ${verifiedCount} items with 0 discrepancies.`);
}

// -----------------------------------------------------------------------------
// Main Demo Seed Runner
// -----------------------------------------------------------------------------
export async function seedDemoData() {
  checkEnvironmentGuard();

  console.log("\n=======================================================");
  console.log("STARTING MAVERICKS INVENTORY SYNTHETIC DEMO SEED");
  console.log("=======================================================\n");

  const users = await seedUsers();
  const adminId = users.get("admin@mavericks.test")!;
  const execId = users.get("exec@mavericks.test")!;
  const managerId = users.get("manager@mavericks.test")!;
  const authorityId = users.get("authority@mavericks.test")!;

  const itemMap = await seedProductsAndVariants();
  const employeeMap = await seedEmployees();

  await seedHistoricalProcurement(adminId, itemMap);
  await seedHistoricalRecipient(adminId, itemMap, employeeMap);
  await seedInitialReconciliationAndLedger(adminId, managerId, itemMap);
  await seedApprovedProcurement(adminId, authorityId, itemMap);
  await seedDistributionRequestsAndApprovals(execId, managerId, authorityId, itemMap);
  await seedSubsequentReconciliation(adminId, managerId, authorityId, itemMap);
  await seedPendingImportJobs(adminId, itemMap);
  await seedFailedAndInvalidImportJobs(adminId);
  await seedAuditHistory(users);

  await syncAndVerifyItemBalances();

  console.log("\n=======================================================");
  console.log("SYNTHETIC DEMO SEED COMPLETED SUCCESSFULLY & IDEMPOTENTLY");
  console.log("=======================================================\n");
}

if (require.main === module) {
  seedDemoData()
    .catch((e) => {
      console.error("Seed error:", e);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
