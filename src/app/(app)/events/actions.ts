"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseEventRecipientsWorkbook } from "@/lib/event-excel";

export async function createEvent(f: FormData) {
  const u = await requireUser(["ADMIN", "EXECUTIVE", "MANAGER"]);
  let err = "";
  let newEventId = "";
  try {
    const name = String(f.get("name") || "").trim();
    const category = String(f.get("category") || "General").trim();
    const location = String(f.get("location") || "").trim() || null;
    const description = String(f.get("description") || "").trim() || null;
    const dateStr = String(f.get("date") || "").trim();
    const date = dateStr ? new Date(dateStr) : new Date();

    if (!name) throw new Error("Event name is required.");

    const event = await db.event.create({
      data: {
        name,
        category,
        location,
        description,
        date,
        status: "ACTIVE",
      },
    });

    newEventId = event.id;

    await db.auditLog.create({
      data: {
        actorId: u.id,
        action: "EVENT_CREATED",
        entity: "Event",
        entityId: event.id,
        detail: { name, category, location, date },
      },
    });
  } catch (e: any) {
    err = e.message || "Failed to create event.";
  }

  if (err) redirect(`/events?error=${encodeURIComponent(err)}`);
  revalidatePath("/events");
  redirect(`/events/${newEventId}?success=Event created successfully.`);
}

export async function toggleEventStatus(f: FormData) {
  const u = await requireUser(["ADMIN", "EXECUTIVE", "MANAGER"]);
  const id = String(f.get("id"));
  const current = String(f.get("status") || "ACTIVE");
  const nextStatus = current === "ACTIVE" ? "COMPLETED" : "ACTIVE";

  await db.event.update({
    where: { id },
    data: { status: nextStatus },
  });

  await db.auditLog.create({
    data: {
      actorId: u.id,
      action: "EVENT_STATUS_UPDATED",
      entity: "Event",
      entityId: id,
      detail: { from: current, to: nextStatus },
    },
  });

  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  redirect(`/events/${id}?success=Event status marked as ${nextStatus}.`);
}

// ---------------------------------------------------------------------------
// Objective B: Safe employee upsert and recipient distribution
// ---------------------------------------------------------------------------
export async function distributeGoodie(f: FormData) {
  return upsertEventRecipientAndDistribute(f);
}

export async function upsertEventRecipientAndDistribute(f: FormData) {
  const u = await requireUser();
  let err = "";
  let successMsg = "";
  let eventId = "";

  try {
    eventId = String(f.get("eventId") || "").trim();
    if (!eventId) throw new Error("Event ID is required.");

    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event) throw new Error("Event not found.");

    const empIdRaw = String(f.get("empId") || "").trim();
    if (!empIdRaw) throw new Error("Employee ID is required.");
    const cleanEmpId = empIdRaw.toUpperCase();

    const name = String(f.get("name") || "").trim();
    const baseLocation = String(f.get("baseLocation") || "").trim();
    const department = String(f.get("department") || "").trim();
    const email = String(f.get("email") || "").trim();
    const recipientType = String(f.get("recipientType") || "PARTICIPANT").trim();
    const notes = String(f.get("notes") || "").trim() || null;
    const actionType = String(f.get("actionType") || "DIRECT_DISTRIBUTE").trim();

    // Parse item lines: either JSON or single item
    let lines: { itemId: string; quantity: number }[] = [];
    const itemsJson = String(f.get("itemsJson") || "");
    if (itemsJson) {
      try {
        lines = JSON.parse(itemsJson);
      } catch {
        lines = [];
      }
    }
    if (!lines.length) {
      const singleItemId = String(f.get("itemId") || "").trim();
      const singleQty = Math.max(1, parseInt(String(f.get("quantity") || "1"), 10));
      if (singleItemId) {
        lines.push({ itemId: singleItemId, quantity: singleQty });
      }
    }

    if (!lines.length) {
      throw new Error("Please select at least one item and quantity to distribute.");
    }

    // Direct distribute requires ADMIN, MANAGER, or AUTHORITY
    if (actionType === "DIRECT_DISTRIBUTE") {
      if (!["ADMIN", "MANAGER", "AUTHORITY"].includes(u.role)) {
        throw new Error("Only Managers or Admins can directly distribute stock without approval. Please submit for approval instead.");
      }
    }

    // Transactional safe upsert & distribution
    await db.$transaction(async (tx) => {
      // 1. Safe Employee Upsert: reuse existing or create new
      let employee = await tx.employee.findUnique({ where: { empId: cleanEmpId } });

      if (employee) {
        // Reuse existing record, updating ONLY explicitly supplied, non-empty profile fields
        const updateData: Record<string, string> = {};
        if (name) updateData.name = name;
        if (baseLocation) updateData.baseLocation = baseLocation;
        if (department) updateData.department = department;
        if (email) updateData.email = email;

        if (Object.keys(updateData).length > 0) {
          employee = await tx.employee.update({
            where: { id: employee.id },
            data: updateData,
          });
        }
      } else {
        // Create new employee only when no matching employee exists and required name is valid
        if (!name) {
          throw new Error(`New employee ${cleanEmpId} requires a valid Name.`);
        }
        employee = await tx.employee.create({
          data: {
            empId: cleanEmpId,
            name,
            baseLocation: baseLocation || "HQ",
            department: department || null,
            email: email || null,
            active: true,
          },
        });
      }

      // Verify each item exists and is active
      const itemIds = lines.map((l) => l.itemId);
      const itemsInDb = await tx.item.findMany({
        where: { id: { in: itemIds }, active: true },
      });
      const itemMap = new Map(itemsInDb.map((i) => [i.id, i]));

      for (const line of lines) {
        const item = itemMap.get(line.itemId);
        if (!item) {
          throw new Error(`Item ID "${line.itemId}" not found or is inactive.`);
        }
        if (line.quantity <= 0) {
          throw new Error(`Quantity for ${item.name} must be greater than zero.`);
        }
      }

      if (actionType === "DIRECT_DISTRIBUTE") {
        // Atomic stock deduction and posted movements
        for (const line of lines) {
          const item = itemMap.get(line.itemId)!;
          const qStr = String(line.quantity);

          const rows = await tx.$queryRaw<{ quantity: string }[]>`
            UPDATE "Item" SET quantity = quantity - ${qStr}::numeric
            WHERE id = ${item.id} AND quantity >= ${qStr}::numeric
            RETURNING quantity::text
          `;

          if (!rows.length) {
            throw new Error(
              `Insufficient stock for "${item.name}". Available stock is ${Number(item.quantity)}, but tried to distribute ${line.quantity}.`
            );
          }

          const balanceAfter = rows[0].quantity;

          const move = await tx.stockMovement.create({
            data: {
              itemId: item.id,
              change: `-${qStr}`,
              balanceAfter,
              type: "DISTRIBUTION_OUT",
              refId: event.id,
              actorId: u.id,
              sourceType: "EVENT",
              sourceId: event.id,
              idempotencyKey: `event-dist:${event.id}:${employee.id}:${item.id}:${Date.now()}`,
              approvedById: u.id,
              approvedAt: new Date(),
              reason: `Event Goodie: ${event.name} (${recipientType}) to ${employee.empId} - ${employee.name}`,
            },
          });

          await tx.distributionRecord.create({
            data: {
              employeeId: employee.id,
              itemId: item.id,
              eventId: event.id,
              recipientType,
              quantity: qStr,
              mode: "NEW",
              distributionDate: new Date(),
              status: "POSTED",
              movementId: move.id,
              category: event.name,
              poc: u.name,
              sourceStatus: "Distributed",
              notes,
            },
          });
        }

        successMsg = `Directly distributed ${lines.length} item line(s) to ${employee.name} (${employee.empId}) for ${event.name}. Stock updated.`;
      } else if (actionType === "SUBMIT_APPROVAL") {
        // Create Request in existing workflow
        const levels = Number(process.env.APPROVAL_LEVELS) === 1 ? 1 : 2;
        const request = await tx.request.create({
          data: {
            requesterId: u.id,
            eventId: event.id,
            employeeId: employee.id,
            purpose: `Event Goodie: ${event.name} (${recipientType}) for ${employee.name} (${employee.empId})`,
            status: "PENDING_MANAGER",
            levels,
            submittedAt: new Date(),
            lines: {
              create: lines.map((l) => ({
                itemId: l.itemId,
                itemName: itemMap.get(l.itemId)!.name,
                quantity: l.quantity,
              })),
            },
          },
        });

        // Create DistributionRecords with status "PENDING_APPROVAL" and sourceRef pointing to request.id
        // Stock is NOT deducted until approved!
        for (const line of lines) {
          const item = itemMap.get(line.itemId)!;
          await tx.distributionRecord.create({
            data: {
              employeeId: employee.id,
              itemId: item.id,
              eventId: event.id,
              recipientType,
              quantity: String(line.quantity),
              mode: "NEW",
              distributionDate: new Date(),
              status: "PENDING_APPROVAL",
              movementId: null,
              sourceRef: request.id,
              category: event.name,
              poc: u.name,
              sourceStatus: "Pending Approval",
              notes,
            },
          });
        }

        successMsg = `Submitted distribution request for ${employee.name} (${employee.empId}) to approval queue (REQ-${request.id.slice(-6).toUpperCase()}).`;
      } else {
        // DRAFT
        const request = await tx.request.create({
          data: {
            requesterId: u.id,
            eventId: event.id,
            employeeId: employee.id,
            purpose: `Draft: ${event.name} (${recipientType}) for ${employee.name}`,
            status: "DRAFT",
            levels: 2,
            lines: {
              create: lines.map((l) => ({
                itemId: l.itemId,
                itemName: itemMap.get(l.itemId)!.name,
                quantity: l.quantity,
              })),
            },
          },
        });

        for (const line of lines) {
          const item = itemMap.get(line.itemId)!;
          await tx.distributionRecord.create({
            data: {
              employeeId: employee.id,
              itemId: item.id,
              eventId: event.id,
              recipientType,
              quantity: String(line.quantity),
              mode: "NEW",
              distributionDate: new Date(),
              status: "DRAFT",
              movementId: null,
              sourceRef: request.id,
              category: event.name,
              poc: u.name,
              sourceStatus: "Draft",
              notes,
            },
          });
        }

        successMsg = `Saved distribution draft for ${employee.name} (${employee.empId}).`;
      }

      await tx.auditLog.create({
        data: {
          actorId: u.id,
          action: `EVENT_RECIPIENT_${actionType}`,
          entity: "Event",
          entityId: event.id,
          detail: {
            employee: `${employee.empId} - ${employee.name}`,
            recipientType,
            linesCount: lines.length,
            actionType,
          },
        },
      });
    }, { maxWait: 15000, timeout: 30000 });
  } catch (e: any) {
    err = e.message || "Failed to process recipient distribution.";
  }

  if (err) {
    redirect(eventId ? `/events/${eventId}?error=${encodeURIComponent(err)}` : `/events?error=${encodeURIComponent(err)}`);
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/employees");
  revalidatePath("/distribution");
  revalidatePath("/inventory");
  revalidatePath("/requests");
  revalidatePath("/");
  redirect(`/events/${eventId}?success=${encodeURIComponent(successMsg)}`);
}

// ---------------------------------------------------------------------------
// Objective C: Spreadsheet preview and bulk import
// ---------------------------------------------------------------------------
export async function previewEventRecipientsFile(f: FormData) {
  await requireUser();
  const file = f.get("file") as File | null;
  if (!file || !file.name) {
    return { error: "Please select an Excel (.xlsx) file to upload." };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { error: "Invalid file format. Please upload an Excel .xlsx workbook." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parseResult = await parseEventRecipientsWorkbook(buffer);

    if (parseResult.recipients.length === 0 && parseResult.errors.length === 0) {
      return { error: "No data rows found in the uploaded workbook." };
    }

    // Pre-fetch employees and items to cross-reference
    const allEmployees = await db.employee.findMany({
      select: { id: true, empId: true, name: true, baseLocation: true, department: true },
    });
    const empMap = new Map(allEmployees.map((e) => [e.empId.toUpperCase(), e]));

    const allItems = await db.item.findMany({
      where: { active: true },
      select: { id: true, sku: true, name: true, quantity: true, unit: true },
    });
    const itemSkuMap = new Map(allItems.map((i) => [i.sku.toUpperCase(), i]));
    const itemNameMap = new Map(allItems.map((i) => [i.name.toLowerCase(), i]));

    const validatedRows = parseResult.recipients.map((r) => {
      const existingEmp = empMap.get(r.empId);
      const isExistingEmployee = !!existingEmp;

      // Find item by SKU first, then by name match
      let matchedItem = itemSkuMap.get(r.itemIdentifier.toUpperCase());
      if (!matchedItem && r.itemIdentifier) {
        matchedItem = itemNameMap.get(r.itemIdentifier.toLowerCase());
      }

      let rowError: string | null = null;
      if (!matchedItem) {
        rowError = `Item "${r.itemIdentifier}" does not match any active inventory SKU or name.`;
      }

      const availableStock = matchedItem ? Number(matchedItem.quantity) : 0;
      const hasSufficientStock = matchedItem ? availableStock >= r.quantity : false;

      return {
        rowNumber: r.rowNumber,
        empId: r.empId,
        name: r.name,
        isExistingEmployee,
        recipientType: r.recipientType,
        itemIdentifier: r.itemIdentifier,
        itemId: matchedItem?.id || null,
        itemName: matchedItem?.name || r.itemIdentifier,
        itemSku: matchedItem?.sku || "N/A",
        quantity: r.quantity,
        availableStock,
        hasSufficientStock,
        baseLocation: r.baseLocation,
        department: r.department,
        email: r.email,
        notes: r.notes,
        rowError,
      };
    });

    return {
      success: true,
      totalRows: parseResult.totalRows,
      validRows: validatedRows.filter((r) => !r.rowError).length,
      errors: parseResult.errors,
      duplicateEmpIds: parseResult.duplicateEmpIds,
      rows: validatedRows,
    };
  } catch (e: any) {
    return { error: e.message || "Failed to parse spreadsheet." };
  }
}

export async function executeEventRecipientsBulkImport(
  eventId: string,
  rows: any[],
  actionType: "DIRECT_DISTRIBUTE" | "SUBMIT_APPROVAL" = "DIRECT_DISTRIBUTE"
) {
  const u = await requireUser();
  if (actionType === "DIRECT_DISTRIBUTE" && !["ADMIN", "MANAGER", "AUTHORITY"].includes(u.role)) {
    throw new Error("Direct stock distribution requires Manager or Admin permissions.");
  }

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found.");

  if (!rows || !rows.length) {
    throw new Error("No rows provided for import.");
  }

  let createdEmployeesCount = 0;
  let updatedEmployeesCount = 0;
  let postedCount = 0;
  let pendingCount = 0;

  await db.$transaction(async (tx) => {
    // Keep local cache of employee entities to prevent re-creating the same employee if repeated in sheet
    const empCache = new Map<string, any>();

    for (const r of rows) {
      if (r.rowError) continue; // skip rows with errors
      const cleanEmpId = String(r.empId).toUpperCase().trim();

      let employee = empCache.get(cleanEmpId);
      if (!employee) {
        employee = await tx.employee.findUnique({ where: { empId: cleanEmpId } });
        if (employee) {
          const updateData: Record<string, string> = {};
          if (r.name && r.name.trim()) updateData.name = r.name.trim();
          if (r.baseLocation && r.baseLocation.trim()) updateData.baseLocation = r.baseLocation.trim();
          if (r.department && r.department.trim()) updateData.department = r.department.trim();
          if (r.email && r.email.trim()) updateData.email = r.email.trim();

          if (Object.keys(updateData).length > 0) {
            employee = await tx.employee.update({
              where: { id: employee.id },
              data: updateData,
            });
          }
          updatedEmployeesCount++;
        } else {
          employee = await tx.employee.create({
            data: {
              empId: cleanEmpId,
              name: String(r.name).trim(),
              baseLocation: r.baseLocation ? String(r.baseLocation).trim() : "HQ",
              department: r.department ? String(r.department).trim() : null,
              email: r.email ? String(r.email).trim() : null,
              active: true,
            },
          });
          createdEmployeesCount++;
        }
        empCache.set(cleanEmpId, employee);
      }

      const item = await tx.item.findUnique({ where: { id: r.itemId } });
      if (!item) {
        throw new Error(`Item ${r.itemName} (${r.itemId}) not found.`);
      }

      const qStr = String(r.quantity);

      if (actionType === "DIRECT_DISTRIBUTE") {
        // Atomic stock deduction
        const deductionRows = await tx.$queryRaw<{ quantity: string }[]>`
          UPDATE "Item" SET quantity = quantity - ${qStr}::numeric
          WHERE id = ${item.id} AND quantity >= ${qStr}::numeric
          RETURNING quantity::text
        `;

        if (!deductionRows.length) {
          throw new Error(`Insufficient stock for "${item.name}" on row ${r.rowNumber}.`);
        }

        const balanceAfter = deductionRows[0].quantity;

        const move = await tx.stockMovement.create({
          data: {
            itemId: item.id,
            change: `-${qStr}`,
            balanceAfter,
            type: "DISTRIBUTION_OUT",
            refId: event.id,
            actorId: u.id,
            sourceType: "EVENT",
            sourceId: event.id,
            idempotencyKey: `bulk-dist:${event.id}:${employee.id}:${item.id}:${r.rowNumber}:${Date.now()}`,
            approvedById: u.id,
            approvedAt: new Date(),
            reason: `Bulk Event Goodie: ${event.name} (${r.recipientType}) to ${employee.empId} - ${employee.name}`,
          },
        });

        await tx.distributionRecord.create({
          data: {
            employeeId: employee.id,
            itemId: item.id,
            eventId: event.id,
            recipientType: r.recipientType,
            quantity: qStr,
            mode: "NEW",
            distributionDate: new Date(),
            status: "POSTED",
            movementId: move.id,
            category: event.name,
            poc: u.name,
            sourceStatus: "Distributed",
            notes: r.notes || null,
          },
        });

        postedCount++;
      } else {
        // Submit for approval
        const levels = Number(process.env.APPROVAL_LEVELS) === 1 ? 1 : 2;
        const request = await tx.request.create({
          data: {
            requesterId: u.id,
            eventId: event.id,
            employeeId: employee.id,
            purpose: `Bulk Event Goodie: ${event.name} (${r.recipientType}) for ${employee.name} (${employee.empId})`,
            status: "PENDING_MANAGER",
            levels,
            submittedAt: new Date(),
            lines: {
              create: [
                {
                  itemId: item.id,
                  itemName: item.name,
                  quantity: r.quantity,
                },
              ],
            },
          },
        });

        await tx.distributionRecord.create({
          data: {
            employeeId: employee.id,
            itemId: item.id,
            eventId: event.id,
            recipientType: r.recipientType,
            quantity: qStr,
            mode: "NEW",
            distributionDate: new Date(),
            status: "PENDING_APPROVAL",
            movementId: null,
            sourceRef: request.id,
            category: event.name,
            poc: u.name,
            sourceStatus: "Pending Approval",
            notes: r.notes || null,
          },
        });

        pendingCount++;
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: u.id,
        action: "EVENT_RECIPIENTS_BULK_IMPORTED",
        entity: "Event",
        entityId: event.id,
        detail: {
          totalRows: rows.length,
          createdEmployeesCount,
          updatedEmployeesCount,
          postedCount,
          pendingCount,
          actionType,
        },
      },
    });
  }, { maxWait: 15000, timeout: 30000 });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/employees");
  revalidatePath("/distribution");
  revalidatePath("/inventory");
  revalidatePath("/requests");
  revalidatePath("/");

  return {
    success: true,
    createdEmployeesCount,
    updatedEmployeesCount,
    postedCount,
    pendingCount,
  };
}
