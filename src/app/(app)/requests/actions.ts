"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseEventRecipientsWorkbook } from "@/lib/event-excel";

export type ExtractedRecipientRow = {
  rowNumber: number;
  empId: string;
  name: string;
  isExistingEmployee: boolean;
  recipientType: "WINNER" | "RUNNER_UP" | "PARTICIPANT" | "SPECIAL_RECOGNITION";
  itemIdentifier: string;
  itemId: string | null;
  itemName: string;
  itemSku: string;
  quantity: number;
  availableStock: number;
  hasSufficientStock: boolean;
  baseLocation?: string;
  department?: string;
  email?: string;
  notes?: string;
  rowError: string | null;
  rowEventName?: string;
};

export type ItemAggregation = {
  itemId: string;
  sku: string;
  name: string;
  unit: string;
  totalRequested: number;
  availableStock: number;
  isSufficient: boolean;
};

export async function previewRequestSpreadsheet(f: FormData) {
  await requireUser(["EXECUTIVE", "ADMIN"]);
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

    // Pre-fetch employees to match/differentiate new vs existing
    const allEmployees = await db.employee.findMany({
      select: { id: true, empId: true, name: true, baseLocation: true, department: true },
    });
    const empMap = new Map(allEmployees.map((e) => [e.empId.toUpperCase(), e]));

    // Pre-fetch items to match SKU or Name
    const allItems = await db.item.findMany({
      where: { active: true },
      select: { id: true, sku: true, name: true, quantity: true, unit: true },
    });
    const itemSkuMap = new Map(allItems.map((i) => [i.sku.toUpperCase(), i]));
    const itemNameMap = new Map(allItems.map((i) => [i.name.toLowerCase().trim(), i]));

    // Pre-fetch existing events to check detected event name
    const allEvents = await db.event.findMany({
      select: { id: true, name: true, category: true, status: true },
    });
    const eventNameMap = new Map(allEvents.map((ev) => [ev.name.toLowerCase().trim(), ev]));

    // Keep track of total demand per item across all rows
    const demandPerItem = new Map<string, number>();

    const validatedRows: ExtractedRecipientRow[] = parseResult.recipients.map((r) => {
      const existingEmp = empMap.get(r.empId);
      const isExistingEmployee = !!existingEmp;

      // Find item by SKU first, then by name match
      let matchedItem = itemSkuMap.get(r.itemIdentifier.toUpperCase().trim());
      if (!matchedItem && r.itemIdentifier) {
        matchedItem = itemNameMap.get(r.itemIdentifier.toLowerCase().trim());
      }

      let rowError: string | null = null;
      if (!matchedItem) {
        rowError = `Item "${r.itemIdentifier}" does not match any active inventory SKU or name.`;
      } else {
        demandPerItem.set(matchedItem.id, (demandPerItem.get(matchedItem.id) || 0) + r.quantity);
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
        rowEventName: r.eventName,
      };
    });

    // Aggregated item summaries
    const itemSummaries: ItemAggregation[] = [];
    demandPerItem.forEach((totalRequested, itemId) => {
      const item = allItems.find((i) => i.id === itemId);
      if (item) {
        const availableStock = Number(item.quantity);
        itemSummaries.push({
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          unit: item.unit,
          totalRequested,
          availableStock,
          isSufficient: availableStock >= totalRequested,
        });
      }
    });

    // Check detected event name against database
    const detectedEventName = parseResult.detectedEventName;
    let matchedEventId: string | undefined;
    let matchedEventName: string | undefined;

    if (detectedEventName) {
      const matchedEvent = eventNameMap.get(detectedEventName.toLowerCase().trim());
      if (matchedEvent) {
        matchedEventId = matchedEvent.id;
        matchedEventName = matchedEvent.name;
      }
    }

    const newEmployeesCount = validatedRows.filter((r) => !r.isExistingEmployee && !r.rowError).length;
    const existingEmployeesCount = validatedRows.filter((r) => r.isExistingEmployee && !r.rowError).length;

    return {
      success: true,
      totalRows: parseResult.totalRows,
      validRows: validatedRows.filter((r) => !r.rowError).length,
      invalidRows: validatedRows.filter((r) => r.rowError).length,
      errors: parseResult.errors,
      duplicateEmpIds: parseResult.duplicateEmpIds,
      rows: validatedRows,
      itemSummaries,
      newEmployeesCount,
      existingEmployeesCount,
      detectedEventName,
      matchedEventId,
      matchedEventName,
    };
  } catch (e: any) {
    return { error: e.message || "Failed to parse spreadsheet." };
  }
}

export type CreateRequestFromExcelPayload = {
  eventId?: string | null;
  newEventName?: string | null;
  eventCategory?: string;
  eventDate?: string;
  purpose?: string;
  intent: "draft" | "submit";
  rows: Array<{
    empId: string;
    name: string;
    recipientType: "WINNER" | "RUNNER_UP" | "PARTICIPANT" | "SPECIAL_RECOGNITION";
    itemId: string;
    quantity: number;
    baseLocation?: string;
    department?: string;
    email?: string;
    notes?: string;
  }>;
};

export async function createRequestFromExcelAction(payload: CreateRequestFromExcelPayload) {
  const u = await requireUser(["EXECUTIVE", "ADMIN"]);

  if (!payload.rows || !payload.rows.length) {
    throw new Error("No recipient rows provided to raise the request.");
  }

  const validRows = payload.rows.filter((r) => r.itemId && r.quantity > 0 && r.empId && r.name);
  if (!validRows.length) {
    throw new Error("No valid recipient lines found in submission.");
  }

  let createdRequestId = "";
  let createdRequestNumber = 0;
  let newEmployeesCount = 0;
  let isEventCreated = false;
  let finalEventName = "";

  await db.$transaction(async (tx) => {
    // 1. Resolve or Auto-create Event
    let event = payload.eventId
      ? await tx.event.findUnique({ where: { id: payload.eventId } })
      : null;

    if (!event && payload.newEventName && payload.newEventName.trim()) {
      const cleanEventName = payload.newEventName.trim();
      // Check case-insensitive existence first
      event = await tx.event.findFirst({
        where: { name: { equals: cleanEventName, mode: "insensitive" } },
      });

      if (!event) {
        event = await tx.event.create({
          data: {
            name: cleanEventName,
            category: payload.eventCategory?.trim() || "Goodies Distribution",
            date: payload.eventDate ? new Date(payload.eventDate) : new Date(),
            status: "ACTIVE",
          },
        });
        isEventCreated = true;
      }
    }

    if (event) {
      finalEventName = event.name;
    }

    // 2. Safe Auto-provisioning & Upsert of Employees
    const empBatchCache = new Map<string, any>();

    for (const r of validRows) {
      const cleanEmpId = r.empId.toUpperCase().trim();
      if (empBatchCache.has(cleanEmpId)) continue;

      let employee = await tx.employee.findUnique({ where: { empId: cleanEmpId } });

      if (employee) {
        // Safe partial update: only update non-empty fields that were missing or provided
        const updateData: Record<string, string> = {};
        if (r.name && r.name.trim() && !employee.name) updateData.name = r.name.trim();
        if (r.baseLocation && r.baseLocation.trim() && employee.baseLocation === "HQ") {
          updateData.baseLocation = r.baseLocation.trim();
        }
        if (r.department && r.department.trim() && !employee.department) {
          updateData.department = r.department.trim();
        }
        if (r.email && r.email.trim() && !employee.email) {
          updateData.email = r.email.trim();
        }

        if (Object.keys(updateData).length > 0) {
          employee = await tx.employee.update({
            where: { id: employee.id },
            data: updateData,
          });
        }
      } else {
        // Auto-create new employee
        employee = await tx.employee.create({
          data: {
            empId: cleanEmpId,
            name: r.name.trim(),
            baseLocation: r.baseLocation ? r.baseLocation.trim() : "HQ",
            department: r.department ? r.department.trim() : null,
            email: r.email ? r.email.trim() : null,
            active: true,
          },
        });
        newEmployeesCount++;
      }

      empBatchCache.set(cleanEmpId, employee);
    }

    // 3. Aggregate item lines for the formal Requisition Request
    const itemQuantities = new Map<string, number>();
    for (const r of validRows) {
      itemQuantities.set(r.itemId, (itemQuantities.get(r.itemId) || 0) + r.quantity);
    }

    const itemIds = Array.from(itemQuantities.keys());
    const itemsInDb = await tx.item.findMany({
      where: { id: { in: itemIds }, active: true },
    });

    if (itemsInDb.length !== itemIds.length) {
      throw new Error("One or more items in the Excel sheet are invalid or inactive in the catalog.");
    }

    const itemMap = new Map(itemsInDb.map((i) => [i.id, i]));

    // 4. Request Number Sequence Sync
    await tx.$executeRaw`
      SELECT setval(
        pg_get_serial_sequence('"Request"', 'number'),
        GREATEST(COALESCE((SELECT MAX(number) FROM "Request"), 0) + 1, 1),
        false
      )
    `;

    // 5. Create Request
    const isSubmit = payload.intent === "submit";
    const levels = Number(process.env.APPROVAL_LEVELS) === 1 ? 1 : 2;
    const defaultPurpose = event
      ? `Event Goodies Requisition: ${event.name} (${validRows.length} recipients)`
      : `Bulk Goodies Requisition (${validRows.length} recipients)`;
    const purpose = (payload.purpose && payload.purpose.trim()) || defaultPurpose;

    const request = await tx.request.create({
      data: {
        requesterId: u.id,
        eventId: event ? event.id : null,
        purpose,
        status: isSubmit ? "PENDING_MANAGER" : "DRAFT",
        levels,
        submittedAt: isSubmit ? new Date() : null,
        lines: {
          create: Array.from(itemQuantities.entries()).map(([itemId, qty]) => ({
            itemId,
            itemName: itemMap.get(itemId)!.name,
            quantity: qty,
          })),
        },
      },
    });

    createdRequestId = request.id;
    createdRequestNumber = request.number;

    // 6. Create Distribution Records linked to this Request and Event
    for (const r of validRows) {
      const employee = empBatchCache.get(r.empId.toUpperCase().trim())!;
      const item = itemMap.get(r.itemId)!;

      await tx.distributionRecord.create({
        data: {
          employeeId: employee.id,
          itemId: item.id,
          eventId: event ? event.id : null,
          recipientType: r.recipientType || "PARTICIPANT",
          quantity: String(r.quantity),
          mode: "NEW",
          distributionDate: new Date(),
          status: isSubmit ? "PENDING_APPROVAL" : "DRAFT",
          movementId: null,
          sourceRef: request.id,
          category: event ? event.name : "Requisition Request",
          poc: u.name,
          sourceStatus: isSubmit ? "Pending Approval" : "Draft",
          notes: r.notes || null,
        },
      });
    }

    // 7. Audit Log
    await tx.auditLog.create({
      data: {
        actorId: u.id,
        action: isSubmit ? "REQUEST_SUBMITTED_FROM_EXCEL" : "REQUEST_DRAFTED_FROM_EXCEL",
        entity: "Request",
        entityId: request.id,
        detail: {
          requestNumber: request.number,
          eventId: event?.id,
          eventName: event?.name,
          recipientsCount: validRows.length,
          newEmployeesCreated: newEmployeesCount,
          totalItemLines: itemQuantities.size,
          status: request.status,
        },
      },
    });
  }, { maxWait: 15000, timeout: 30000 });

  revalidatePath("/requests");
  revalidatePath(`/requests/${createdRequestId}`);
  if (payload.eventId) revalidatePath(`/events/${payload.eventId}`);
  revalidatePath("/events");
  revalidatePath("/distribution");
  revalidatePath("/employees");
  revalidatePath("/");

  return {
    success: true,
    requestId: createdRequestId,
    requestNumber: createdRequestNumber,
    newEmployeesCount,
    isEventCreated,
    finalEventName,
  };
}
