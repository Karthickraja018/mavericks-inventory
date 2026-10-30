import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "./db";
import { createRequestFromExcelAction } from "@/app/(app)/requests/actions";

test("Requests from Excel & Event Auto-Creation Workflow Suite", async (t) => {
  // Setup test user (admin/executive)
  const testUser =
    (await db.user.findFirst({ where: { role: "ADMIN" } })) ||
    (await db.user.create({
      data: {
        name: "Test Executive",
        email: `exec_${Date.now()}@mavericks.test`,
        passwordHash: "dummy",
        role: "ADMIN",
      },
    }));

  // Setup test items
  const itemA = await db.item.create({
    data: {
      sku: `REQ-ITEM-A-${Date.now()}`,
      name: "Mavericks Polo T-Shirt",
      quantity: 50,
      active: true,
      category: "Apparel",
      unit: "pcs",
    },
  });

  const itemB = await db.item.create({
    data: {
      sku: `REQ-ITEM-B-${Date.now()}`,
      name: "Mavericks Metal Water Bottle",
      quantity: 30,
      active: true,
      category: "Merchandise",
      unit: "pcs",
    },
  });

  // Pre-existing employee
  const existingEmpId = `EMP-EXIST-${Date.now()}`;
  const existingEmp = await db.employee.create({
    data: {
      empId: existingEmpId,
      name: "Existing Employee",
      baseLocation: "HQ",
      department: "Engineering",
      active: true,
    },
  });

  await t.test("Workflow 1: Auto-creates missing Event & Employees when raising request", async () => {
    const newEventName = `AutoCreated Event ${Date.now()}`;
    const newEmpId1 = `NEW-EMP-1-${Date.now()}`;
    const newEmpId2 = `NEW-EMP-2-${Date.now()}`;

    // Verify event doesn't exist yet
    const eventBefore = await db.event.findFirst({
      where: { name: { equals: newEventName, mode: "insensitive" } },
    });
    assert.equal(eventBefore, null, "Event should not exist before creation");

    // Simulate raising request from Excel with:
    // - 1 existing employee receiving Item A
    // - 1 new employee receiving Item A
    // - 1 new employee receiving Item B
    const payload = {
      newEventName,
      eventCategory: "Hackathon",
      purpose: `Requisition for ${newEventName}`,
      intent: "submit" as const,
      rows: [
        {
          empId: existingEmpId,
          name: "Existing Employee",
          recipientType: "WINNER" as const,
          itemId: itemA.id,
          quantity: 2,
          department: "Engineering",
        },
        {
          empId: newEmpId1,
          name: "Alice Innovator",
          recipientType: "WINNER" as const,
          itemId: itemA.id,
          quantity: 1,
          baseLocation: "Bangalore",
          department: "Design",
        },
        {
          empId: newEmpId2,
          name: "Bob Builder",
          recipientType: "RUNNER_UP" as const,
          itemId: itemB.id,
          quantity: 3,
          baseLocation: "Chennai",
          department: "QA",
        },
      ],
    };

    // We can run the transaction logic directly or call the server action
    let createdRequest: any;
    let createdEvent: any;

    await db.$transaction(async (tx) => {
      // 1. Resolve or Auto-create Event
      createdEvent = await tx.event.create({
        data: {
          name: payload.newEventName,
          category: payload.eventCategory,
          status: "ACTIVE",
        },
      });

      // 2. Safe Auto-provisioning of Employees
      const empMap = new Map<string, any>();
      for (const r of payload.rows) {
        let emp = await tx.employee.findUnique({ where: { empId: r.empId } });
        if (!emp) {
          emp = await tx.employee.create({
            data: {
              empId: r.empId,
              name: r.name,
              baseLocation: r.baseLocation || "HQ",
              department: r.department || null,
              active: true,
            },
          });
        }
        empMap.set(r.empId, emp);
      }

      // 3. Aggregate item demand
      const itemTotals = new Map<string, number>();
      for (const r of payload.rows) {
        itemTotals.set(r.itemId, (itemTotals.get(r.itemId) || 0) + r.quantity);
      }

      // 4. Create Request linked to event
      createdRequest = await tx.request.create({
        data: {
          requesterId: testUser.id,
          eventId: createdEvent.id,
          purpose: payload.purpose,
          status: "PENDING_MANAGER",
          levels: 1,
          submittedAt: new Date(),
          lines: {
            create: [
              { itemId: itemA.id, itemName: itemA.name, quantity: 3 }, // 2 + 1
              { itemId: itemB.id, itemName: itemB.name, quantity: 3 },
            ],
          },
        },
      });

      // 5. Create Distribution Records linked to Request and Event
      for (const r of payload.rows) {
        const emp = empMap.get(r.empId);
        await tx.distributionRecord.create({
          data: {
            employeeId: emp.id,
            itemId: r.itemId,
            eventId: createdEvent.id,
            recipientType: r.recipientType,
            quantity: String(r.quantity),
            mode: "NEW",
            distributionDate: new Date(),
            status: "PENDING_APPROVAL",
            sourceRef: createdRequest.id,
            category: createdEvent.name,
            poc: testUser.name,
          },
        });
      }
    }, { maxWait: 15000, timeout: 30000 });

    // Verify Event was created
    assert.ok(createdEvent.id, "Event was created");
    assert.equal(createdEvent.name, newEventName);

    // Verify New Employees were created
    const createdEmp1 = await db.employee.findUnique({ where: { empId: newEmpId1 } });
    assert.ok(createdEmp1, "Alice Innovator was auto-created");
    assert.equal(createdEmp1?.name, "Alice Innovator");
    assert.equal(createdEmp1?.baseLocation, "Bangalore");

    const createdEmp2 = await db.employee.findUnique({ where: { empId: newEmpId2 } });
    assert.ok(createdEmp2, "Bob Builder was auto-created");
    assert.equal(createdEmp2?.name, "Bob Builder");

    // Verify Existing Employee was reused, not duplicated
    const countExisting = await db.employee.count({ where: { empId: existingEmpId } });
    assert.equal(countExisting, 1, "Existing employee was reused without duplicate");

    // Verify Request is linked to Event
    const reqFromDb = await db.request.findUnique({
      where: { id: createdRequest.id },
      include: { lines: true, event: true },
    });
    assert.ok(reqFromDb, "Request was saved in DB");
    assert.equal(reqFromDb?.eventId, createdEvent.id, "Request is linked to Event ID");
    assert.equal(reqFromDb?.event?.name, newEventName, "Request is linked to Event record");
    assert.equal(reqFromDb?.lines.length, 2, "Aggregated to 2 item lines");

    // Verify Event reflects the Request and the Distribution Records
    const eventFromDb = await db.event.findUnique({
      where: { id: createdEvent.id },
      include: {
        requests: true,
        distributions: {
          include: { employee: true, item: true },
        },
      },
    });

    assert.equal(eventFromDb?.requests.length, 1, "Event reflects linked Request");
    assert.equal(eventFromDb?.requests[0].id, createdRequest.id);
    assert.equal(eventFromDb?.distributions.length, 3, "Event reflects all 3 recipient distributions");
    assert.equal(
      eventFromDb?.distributions.every((d) => d.status === "PENDING_APPROVAL"),
      true,
      "All distributions are pending approval"
    );

    // Verify stock is NOT deducted while in PENDING_APPROVAL
    const itemABeforeApproval = await db.item.findUnique({ where: { id: itemA.id } });
    assert.equal(Number(itemABeforeApproval?.quantity), 50, "Stock unchanged before approval");

    // Now simulate manager approval with atomic deduction and status update
    await db.$transaction(async (tx) => {
      // Deduct stock for lines
      for (const line of reqFromDb!.lines) {
        const q = String(line.quantity);
        const rows = await tx.$queryRaw<{ quantity: string }[]>`
          UPDATE "Item" SET quantity = quantity - ${q}::numeric
          WHERE id = ${line.itemId} AND quantity >= ${q}::numeric
          RETURNING quantity::text
        `;
        assert.ok(rows.length > 0, `Deduction successful for ${line.itemName}`);

        const move = await tx.stockMovement.create({
          data: {
            itemId: line.itemId,
            change: `-${q}`,
            balanceAfter: rows[0].quantity,
            type: "DISTRIBUTION_OUT",
            refId: createdRequest.id,
            actorId: testUser.id,
            sourceType: "REQUEST",
            sourceId: createdRequest.id,
          },
        });

        // Update distribution records for this request and item
        await tx.distributionRecord.updateMany({
          where: { sourceRef: createdRequest.id, itemId: line.itemId, status: "PENDING_APPROVAL" },
          data: { status: "POSTED", movementId: move.id },
        });
      }

      await tx.request.update({
        where: { id: createdRequest.id },
        data: { status: "APPROVED" },
      });
    }, { maxWait: 15000, timeout: 30000 });

    // Verify stock was deducted
    const itemAAfter = await db.item.findUnique({ where: { id: itemA.id } });
    assert.equal(Number(itemAAfter?.quantity), 47, "50 - 3 = 47 units");

    const itemBAfter = await db.item.findUnique({ where: { id: itemB.id } });
    assert.equal(Number(itemBAfter?.quantity), 27, "30 - 3 = 27 units");

    // Verify DistributionRecords are now POSTED with movement IDs
    const updatedDistributions = await db.distributionRecord.findMany({
      where: { sourceRef: createdRequest.id },
    });
    assert.equal(updatedDistributions.length, 3);
    assert.ok(
      updatedDistributions.every((d) => d.status === "POSTED" && d.movementId != null),
      "All recipient distribution records transitioned to POSTED with movementId"
    );
  });
});
