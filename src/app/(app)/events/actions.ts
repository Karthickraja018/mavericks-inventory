"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function createEvent(f: FormData) {
  const u = await requireUser(["ADMIN", "EXECUTIVE", "MANAGER"]);
  let err = "";
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
  redirect("/events?success=Event created successfully.");
}

export async function distributeGoodie(f: FormData) {
  const u = await requireUser(["ADMIN", "EXECUTIVE", "MANAGER"]);
  let err = "";
  let successMsg = "";

  try {
    const eventId = String(f.get("eventId") || "").trim() || null;
    const employeeId = String(f.get("employeeId") || "").trim();
    const itemId = String(f.get("itemId") || "").trim();
    const quantityNum = Math.max(1, parseInt(String(f.get("quantity") || "1"), 10));
    const recipientType = String(f.get("recipientType") || "PARTICIPANT").trim();
    const notes = String(f.get("notes") || "").trim() || null;

    if (!employeeId) throw new Error("Please select an employee.");
    if (!itemId) throw new Error("Please select an item/goodie to distribute.");

    const employee = await db.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new Error("Employee not found.");

    const item = await db.item.findUnique({ where: { id: itemId } });
    if (!item) throw new Error("Item not found in inventory.");

    let eventName = "Direct Goodie Distribution";
    if (eventId) {
      const event = await db.event.findUnique({ where: { id: eventId } });
      if (event) eventName = event.name;
    }

    const qStr = String(quantityNum);

    await db.$transaction(async (tx) => {
      // 1. Atomic stock deduction
      const rows = await tx.$queryRaw<{ quantity: string }[]>`
        UPDATE "Item" SET quantity = quantity - ${qStr}::numeric
        WHERE id = ${itemId} AND quantity >= ${qStr}::numeric
        RETURNING quantity::text
      `;

      if (!rows.length) {
        throw new Error(
          `Insufficient stock for "${item.name}". Available stock is ${Number(item.quantity)}, but tried to distribute ${quantityNum}.`
        );
      }

      const balanceAfter = rows[0].quantity;

      // 2. Ledger movement
      const move = await tx.stockMovement.create({
        data: {
          itemId: item.id,
          change: `-${qStr}`,
          balanceAfter,
          type: "DISTRIBUTION_OUT",
          refId: eventId || `direct:${Date.now()}`,
          actorId: u.id,
          sourceType: "EVENT",
          sourceId: eventId || undefined,
          idempotencyKey: `event-dist:${Date.now()}:${employee.id}:${item.id}`,
          approvedById: u.id,
          approvedAt: new Date(),
          reason: `Event Goodie: ${eventName} (${recipientType}) to ${employee.empId} - ${employee.name}`,
        },
      });

      // 3. Distribution record
      await tx.distributionRecord.create({
        data: {
          employeeId: employee.id,
          itemId: item.id,
          eventId: eventId || undefined,
          recipientType,
          quantity: qStr,
          mode: "NEW",
          distributionDate: new Date(),
          category: eventName,
          poc: u.name,
          sourceStatus: "Distributed",
          movementId: move.id,
          notes,
        },
      });

      // 4. Audit log
      await tx.auditLog.create({
        data: {
          actorId: u.id,
          action: "GOODIE_DISTRIBUTED",
          entity: "DistributionRecord",
          entityId: move.id,
          detail: {
            employee: `${employee.empId} - ${employee.name}`,
            item: `${item.sku} - ${item.name}`,
            quantity: quantityNum,
            event: eventName,
            recipientType,
          },
        },
      });
    });

    successMsg = `Distributed ${quantityNum}x "${item.name}" to ${employee.name} (${employee.empId}) for ${eventName} [${recipientType}].`;
  } catch (e: any) {
    err = e.message || "Failed to distribute goodie.";
  }

  if (err) redirect(`/events?error=${encodeURIComponent(err)}`);
  revalidatePath("/events");
  revalidatePath("/employees");
  revalidatePath("/distribution");
  revalidatePath("/inventory");
  revalidatePath("/");
  redirect(`/events?success=${encodeURIComponent(successMsg)}`);
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
  redirect("/events?success=Event status updated.");
}
