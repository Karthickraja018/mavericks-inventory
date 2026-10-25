import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function verifyIntegrity() {
  console.log("\n=======================================================");
  console.log("RUNNING DATABASE INTEGRITY & DEMO DATA VERIFICATION");
  console.log("=======================================================\n");

  const [
    userCount,
    productCount,
    itemCount,
    employeeCount,
    movementCount,
    requestCount,
    approvalCount,
    importJobCount,
    importRowCount,
    reconCount,
    procCount,
    distCount,
    auditCount,
  ] = await Promise.all([
    db.user.count(),
    db.product.count(),
    db.item.count(),
    db.employee.count(),
    db.stockMovement.count(),
    db.request.count(),
    db.approval.count(),
    db.importJob.count(),
    db.importRow.count(),
    db.reconciliationReview.count(),
    db.procurementRecord.count(),
    db.distributionRecord.count(),
    db.auditLog.count(),
  ]);

  console.log("Record Counts in Database:");
  console.log(`- Users: ${userCount}`);
  console.log(`- Products: ${productCount}`);
  console.log(`- Item variants: ${itemCount}`);
  console.log(`- Employees: ${employeeCount}`);
  console.log(`- Stock Movements: ${movementCount}`);
  console.log(`- Requests: ${requestCount}`);
  console.log(`- Approvals: ${approvalCount}`);
  console.log(`- Import Jobs: ${importJobCount}`);
  console.log(`- Import Rows: ${importRowCount}`);
  console.log(`- Reconciliation Reviews: ${reconCount}`);
  console.log(`- Procurement Records: ${procCount}`);
  console.log(`- Distribution Records: ${distCount}`);
  console.log(`- Audit Logs: ${auditCount}`);

  // Check 1: Ledger consistency for every single item
  console.log("\nChecking ledger consistency across all items...");
  const items = await db.item.findMany();
  let discrepancyFound = false;

  for (const item of items) {
    const ledgerSum = await db.stockMovement
      .aggregate({
        _sum: { change: true },
        where: { itemId: item.id },
      })
      .then((r) => Number(r._sum.change ?? 0));

    const cachedQty = Number(item.quantity);
    const diff = Math.abs(ledgerSum - cachedQty);

    if (diff > 0.0001) {
      console.error(`DISCREPANCY in item ${item.sku}: cached = ${cachedQty}, ledger = ${ledgerSum}`);
      discrepancyFound = true;
    }

    if (cachedQty < 0) {
      console.error(`NEGATIVE STOCK in item ${item.sku}: quantity = ${cachedQty}`);
      discrepancyFound = true;
    }
  }

  if (!discrepancyFound) {
    console.log("✔ All items have 100% agreement between cached quantity and stock movement ledger.");
    console.log("✔ Zero items have negative stock balances.");
  } else {
    throw new Error("Integrity check failed: Discrepancy or negative stock detected.");
  }

  // Check 2: Historical imports do not change stock
  console.log("\nChecking historical imports provenance isolation...");
  const histProc = await db.procurementRecord.findMany({ where: { mode: "HISTORICAL" } });
  const histProcWithMoves = histProc.filter((p) => p.movementId !== null);
  if (histProcWithMoves.length > 0) {
    throw new Error(`Integrity check failed: ${histProcWithMoves.length} historical procurement records posted stock movements!`);
  }
  console.log(`✔ Verified ${histProc.length} historical procurement records: 0 stock movements posted.`);

  const histDist = await db.distributionRecord.findMany({ where: { mode: "HISTORICAL" } });
  const histDistWithMoves = histDist.filter((d) => d.movementId !== null);
  if (histDistWithMoves.length > 0) {
    throw new Error(`Integrity check failed: ${histDistWithMoves.length} historical distribution records posted stock movements!`);
  }
  console.log(`✔ Verified ${histDist.length} historical distribution records: 0 stock movements posted.`);

  // Check 3: Pending & Rejected operations do not affect stock
  console.log("\nChecking pending and rejected operations...");
  const pendingRequests = await db.request.findMany({ where: { status: { in: ["DRAFT", "PENDING_MANAGER", "PENDING_AUTHORITY", "REJECTED", "NEEDS_REVIEW"] } } });
  for (const pr of pendingRequests) {
    const moves = await db.stockMovement.findMany({ where: { refId: pr.id } });
    if (moves.length > 0) {
      throw new Error(`Request ${pr.id} in status ${pr.status} has ${moves.length} posted stock movements!`);
    }
  }
  console.log(`✔ Verified ${pendingRequests.length} non-approved requests: 0 stock movements posted.`);

  // Check 4: Approved distributions deduct stock exactly once
  const approvedRequests = await db.request.findMany({ where: { status: "APPROVED" }, include: { lines: true } });
  for (const ar of approvedRequests) {
    const moves = await db.stockMovement.findMany({ where: { refId: ar.id } });
    if (moves.length !== ar.lines.length) {
      throw new Error(`Approved request ${ar.id} has ${ar.lines.length} lines but ${moves.length} movements.`);
    }
  }
  console.log(`✔ Verified ${approvedRequests.length} approved distribution requests: exactly 1 deduction per line.`);

  // Check 5: Failed and rolled back imports have 0 business records
  const failedJobs = await db.importJob.findMany({ where: { status: { in: ["FAILED", "ROLLED_BACK"] } } });
  for (const fj of failedJobs) {
    const pCount = await db.procurementRecord.count({ where: { importJobId: fj.id } });
    const dCount = await db.distributionRecord.count({ where: { importJobId: fj.id } });
    if (pCount > 0 || dCount > 0) {
      throw new Error(`Failed/rolled-back job ${fj.filename} has partial business records (${pCount} proc, ${dCount} dist).`);
    }
  }
  console.log(`✔ Verified ${failedJobs.length} failed/rolled-back import jobs: 0 partial business records committed.`);

  console.log("\n=======================================================");
  console.log("ALL INTEGRITY CHECKS PASSED WITH 100% SUCCESS!");
  console.log("=======================================================\n");
}

verifyIntegrity()
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
