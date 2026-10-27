import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "./db";

test("Events & Goodies Workflow Suite", async (t) => {
  // Setup clean test event
  const testEvent = await db.event.create({
    data: {
      name: `Test Hackathon ${Date.now()}`,
      category: "Hackathon",
      location: "Chennai Tech Campus",
      status: "ACTIVE",
    },
  });

  // Setup test user (admin/manager)
  const testUser = await db.user.findFirst({ where: { role: "ADMIN" } }) || await db.user.create({
    data: {
      name: "Test Admin",
      email: `admin_${Date.now()}@mavericks.test`,
      passwordHash: "dummy",
      role: "ADMIN",
    },
  });

  // Setup test item with ample stock
  const testItem = await db.item.create({
    data: {
      sku: `TEST-SWAG-${Date.now()}`,
      name: "Test Hackathon Swag Pack",
      quantity: 100,
      active: true,
      category: "Swag",
      unit: "pcs",
    },
  });

  const testItem2 = await db.item.create({
    data: {
      sku: `TEST-HOODIE-${Date.now()}`,
      name: "Test Hackathon Hoodie",
      quantity: 50,
      active: true,
      category: "Apparel",
      unit: "pcs",
    },
  });

  // -------------------------------------------------------------------------
  // Scenario 1: Add a new employee as an event recipient
  // -------------------------------------------------------------------------
  await t.test("Scenario 1: Safe creation of new employee recipient", async () => {
    const cleanEmpId = `TEST-EMP-${Date.now()}`;
    const name = "Priya Raman";

    // Simulate upsert for new employee
    const newEmp = await db.$transaction(async (tx) => {
      let emp = await tx.employee.findUnique({ where: { empId: cleanEmpId } });
      if (!emp) {
        emp = await tx.employee.create({
          data: {
            empId: cleanEmpId,
            name,
            baseLocation: "HQ",
            department: "Engineering",
            active: true,
          },
        });
      }
      return emp;
    });

    assert.ok(newEmp.id, "New employee created with ID");
    assert.equal(newEmp.empId, cleanEmpId);
    assert.equal(newEmp.name, name);
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Add an existing employee and verify no duplicate is created
  // -------------------------------------------------------------------------
  await t.test("Scenario 2: Existing employee reused without duplicate creation", async () => {
    const existingEmpId = `TEST-REUSE-${Date.now()}`;
    const initial = await db.employee.create({
      data: {
        empId: existingEmpId,
        name: "Vikram Seth",
        baseLocation: "Bangalore",
        department: "Product",
        active: true,
      },
    });

    const initialCount = await db.employee.count({ where: { empId: existingEmpId } });
    assert.equal(initialCount, 1);

    // Run safe upsert with updated department only
    const updated = await db.$transaction(async (tx) => {
      let emp = await tx.employee.findUnique({ where: { empId: existingEmpId } });
      if (emp) {
        emp = await tx.employee.update({
          where: { id: emp.id },
          data: { department: "Platform Engineering" },
        });
      }
      return emp;
    });

    assert.equal(updated?.id, initial.id, "Existing ID must be reused");
    assert.equal(updated?.department, "Platform Engineering");

    const finalCount = await db.employee.count({ where: { empId: existingEmpId } });
    assert.equal(finalCount, 1, "Must NOT create duplicate employee entity");
  });

  // -------------------------------------------------------------------------
  // Scenario 3 & 4: Multiple goodies to one employee and multiple recipients
  // -------------------------------------------------------------------------
  await t.test("Scenario 3 & 4: Multiple goodies per employee and multiple recipients", async () => {
    const emp1 = await db.employee.create({
      data: {
        empId: `EMP-MULTI-1-${Date.now()}`,
        name: "Arun Kumar",
        baseLocation: "HQ",
        active: true,
      },
    });

    const emp2 = await db.employee.create({
      data: {
        empId: `EMP-MULTI-2-${Date.now()}`,
        name: "Bhavna Patel",
        baseLocation: "HQ",
        active: true,
      },
    });

    // Emp 1 receives 2 distinct items (Swag Pack + Hoodie)
    await db.distributionRecord.createMany({
      data: [
        {
          employeeId: emp1.id,
          itemId: testItem.id,
          eventId: testEvent.id,
          recipientType: "WINNER",
          quantity: 2,
          mode: "NEW",
          distributionDate: new Date(),
          status: "POSTED",
          category: testEvent.name,
        },
        {
          employeeId: emp1.id,
          itemId: testItem2.id,
          eventId: testEvent.id,
          recipientType: "WINNER",
          quantity: 1,
          mode: "NEW",
          distributionDate: new Date(),
          status: "POSTED",
          category: testEvent.name,
        },
        {
          employeeId: emp2.id,
          itemId: testItem.id,
          eventId: testEvent.id,
          recipientType: "RUNNER_UP",
          quantity: 1,
          mode: "NEW",
          distributionDate: new Date(),
          status: "POSTED",
          category: testEvent.name,
        },
      ],
    });

    const eventDistributions = await db.distributionRecord.findMany({
      where: { eventId: testEvent.id },
    });

    const uniqueRecipients = new Set(eventDistributions.map((d) => d.employeeId)).size;
    assert.equal(uniqueRecipients, 2, "2 distinct recipients");
    assert.equal(eventDistributions.length, 3, "3 recipient distribution line records");

    const emp1Lines = eventDistributions.filter((d) => d.employeeId === emp1.id);
    assert.equal(emp1Lines.length, 2, "Emp 1 has 2 distinct goodie records");
    const emp1TotalQty = emp1Lines.reduce((sum, d) => sum + Number(d.quantity), 0);
    assert.equal(emp1TotalQty, 3, "Emp 1 total quantity is 2 + 1 = 3");
  });

  // -------------------------------------------------------------------------
  // Scenario 5: Submit distribution for approval — verify not counted as completed
  // -------------------------------------------------------------------------
  await t.test("Scenario 5: Pending approval does not deduct stock or inflate distributed count", async () => {
    const emp = await db.employee.create({
      data: {
        empId: `EMP-PENDING-${Date.now()}`,
        name: "Sneha Reddy",
        baseLocation: "Hyderabad",
        active: true,
      },
    });

    const initialStock = Number((await db.item.findUnique({ where: { id: testItem.id } }))!.quantity);

    // Create a pending request
    const req = await db.request.create({
      data: {
        requesterId: testUser.id,
        eventId: testEvent.id,
        employeeId: emp.id,
        purpose: "Event Goodie: Winner Swag",
        status: "PENDING_MANAGER",
        levels: 1,
        lines: {
          create: [{ itemId: testItem.id, itemName: testItem.name, quantity: 5 }],
        },
      },
    });

    // Create distribution record in PENDING_APPROVAL
    const distRec = await db.distributionRecord.create({
      data: {
        employeeId: emp.id,
        itemId: testItem.id,
        eventId: testEvent.id,
        recipientType: "WINNER",
        quantity: 5,
        mode: "NEW",
        distributionDate: new Date(),
        status: "PENDING_APPROVAL",
        movementId: null,
        sourceRef: req.id,
      },
    });

    // Verify stock was NOT deducted
    const stockAfterSubmission = Number((await db.item.findUnique({ where: { id: testItem.id } }))!.quantity);
    assert.equal(stockAfterSubmission, initialStock, "Stock must remain unchanged while pending approval");

    // Verify authoritative distributed query excludes pending
    const postedUnits = await db.distributionRecord.aggregate({
      where: { eventId: testEvent.id, status: "POSTED" },
      _sum: { quantity: true },
    });
    // Our earlier posted records had 2 + 1 + 1 = 4 units
    assert.equal(Number(postedUnits._sum.quantity), 4, "Pending record of 5 units must NOT be in posted sum");
  });

  // -------------------------------------------------------------------------
  // Scenario 6: Approve distribution — verify stock decreases exactly once and ledger reflects
  // -------------------------------------------------------------------------
  await t.test("Scenario 6: Approval executes atomic stock deduction and posts ledger transaction", async () => {
    const emp = await db.employee.create({
      data: {
        empId: `EMP-APPROVE-${Date.now()}`,
        name: "Gautam Gambhir",
        baseLocation: "HQ",
        active: true,
      },
    });

    const initialStock = Number((await db.item.findUnique({ where: { id: testItem.id } }))!.quantity);

    const req = await db.request.create({
      data: {
        requesterId: testUser.id,
        eventId: testEvent.id,
        employeeId: emp.id,
        purpose: "Final Approval Test",
        status: "PENDING_MANAGER",
        levels: 1,
        lines: {
          create: [{ itemId: testItem.id, itemName: testItem.name, quantity: 3 }],
        },
      },
    });

    const distRec = await db.distributionRecord.create({
      data: {
        employeeId: emp.id,
        itemId: testItem.id,
        eventId: testEvent.id,
        recipientType: "WINNER",
        quantity: 3,
        mode: "NEW",
        distributionDate: new Date(),
        status: "PENDING_APPROVAL",
        movementId: null,
        sourceRef: req.id,
      },
    });

    // Simulate approval transaction
    await db.$transaction(async (tx) => {
      const q = "3";
      const rows = await tx.$queryRaw<{ quantity: string }[]>`
        UPDATE "Item" SET quantity = quantity - ${q}::numeric
        WHERE id = ${testItem.id} AND quantity >= ${q}::numeric
        RETURNING quantity::text
      `;
      assert.ok(rows.length > 0, "Deduction row returned");

      const move = await tx.stockMovement.create({
        data: {
          itemId: testItem.id,
          change: `-${q}`,
          balanceAfter: rows[0].quantity,
          type: "DISTRIBUTION_OUT",
          refId: req.id,
          actorId: testUser.id,
          sourceType: "REQUEST",
          sourceId: req.id,
          idempotencyKey: `dist-test:${req.id}:${testItem.id}`,
          approvedById: testUser.id,
          approvedAt: new Date(),
        },
      });

      await tx.distributionRecord.updateMany({
        where: { sourceRef: req.id, itemId: testItem.id, status: "PENDING_APPROVAL" },
        data: { status: "POSTED", movementId: move.id },
      });

      await tx.request.update({
        where: { id: req.id },
        data: { status: "APPROVED" },
      });
    });

    const finalStock = Number((await db.item.findUnique({ where: { id: testItem.id } }))!.quantity);
    assert.equal(finalStock, initialStock - 3, "Stock decreased by exactly 3");

    const updatedDistRec = await db.distributionRecord.findUnique({ where: { id: distRec.id } });
    assert.equal(updatedDistRec?.status, "POSTED");
    assert.ok(updatedDistRec?.movementId, "Movement ID must be attached");

    const moveInDb = await db.stockMovement.findUnique({ where: { id: updatedDistRec!.movementId! } });
    assert.equal(moveInDb?.type, "DISTRIBUTION_OUT");
    assert.equal(Number(moveInDb?.change), -3);
  });

  // -------------------------------------------------------------------------
  // Scenario 7: Reject a request and verify stock is NOT deducted
  // -------------------------------------------------------------------------
  await t.test("Scenario 7: Rejection updates status to REJECTED and preserves stock", async () => {
    const emp = await db.employee.create({
      data: {
        empId: `EMP-REJECT-${Date.now()}`,
        name: "Kavita Krishnan",
        baseLocation: "HQ",
        active: true,
      },
    });

    const stockBefore = Number((await db.item.findUnique({ where: { id: testItem.id } }))!.quantity);

    const req = await db.request.create({
      data: {
        requesterId: testUser.id,
        eventId: testEvent.id,
        employeeId: emp.id,
        purpose: "Rejection Test",
        status: "PENDING_MANAGER",
        levels: 1,
        lines: {
          create: [{ itemId: testItem.id, itemName: testItem.name, quantity: 10 }],
        },
      },
    });

    const distRec = await db.distributionRecord.create({
      data: {
        employeeId: emp.id,
        itemId: testItem.id,
        eventId: testEvent.id,
        recipientType: "PARTICIPANT",
        quantity: 10,
        mode: "NEW",
        distributionDate: new Date(),
        status: "PENDING_APPROVAL",
        sourceRef: req.id,
      },
    });

    // Simulate rejection
    await db.$transaction(async (tx) => {
      await tx.request.update({ where: { id: req.id }, data: { status: "REJECTED" } });
      await tx.distributionRecord.updateMany({
        where: { sourceRef: req.id, status: { in: ["PENDING_APPROVAL", "DRAFT"] } },
        data: { status: "REJECTED" },
      });
    });

    const stockAfter = Number((await db.item.findUnique({ where: { id: testItem.id } }))!.quantity);
    assert.equal(stockAfter, stockBefore, "Stock must NOT decrease on rejection");

    const rejectedDistRec = await db.distributionRecord.findUnique({ where: { id: distRec.id } });
    assert.equal(rejectedDistRec?.status, "REJECTED");
    assert.equal(rejectedDistRec?.movementId, null);
  });

  // -------------------------------------------------------------------------
  // Scenario 8: Duplicate submission / Idempotent behavior
  // -------------------------------------------------------------------------
  await t.test("Scenario 8: Idempotency keys prevent double movement creation", async () => {
    const idempotencyKey = `idempotent-test:${Date.now()}`;

    // First insert
    await db.stockMovement.create({
      data: {
        itemId: testItem.id,
        change: -1,
        balanceAfter: 50,
        type: "DISTRIBUTION_OUT",
        actorId: testUser.id,
        idempotencyKey,
      },
    });

    // Second insert with same idempotencyKey should be rejected by DB unique index
    await assert.rejects(
      async () => {
        await db.stockMovement.create({
          data: {
            itemId: testItem.id,
            change: -1,
            balanceAfter: 49,
            type: "DISTRIBUTION_OUT",
            actorId: testUser.id,
            idempotencyKey,
          },
        });
      },
      /Unique constraint failed/i,
      "Duplicate movement submission with same idempotency key must fail"
    );
  });

  // Clean up test event and test records (StockMovement is append-only in Postgres ledger)
  await db.distributionRecord.deleteMany({ where: { eventId: testEvent.id } });
  await db.requestLine.deleteMany({ where: { request: { eventId: testEvent.id } } });
  await db.request.deleteMany({ where: { eventId: testEvent.id } });
  await db.item.updateMany({ where: { id: { in: [testItem.id, testItem2.id] } }, data: { active: false } });
  await db.event.delete({ where: { id: testEvent.id } });
});
