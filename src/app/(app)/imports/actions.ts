"use server";
import { createHash } from "crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readFirstSheet, validateRows, TEMPLATES, TemplateKey, normalizeEmployeeFields, normalizeProductFields } from "@/lib/imports";
import { revalidatePath } from "next/cache";

// Gate 2: upload, parse, validate, stage. Writes ONLY to ImportJob/ImportRow (staging). No stock or business effect.
export async function uploadImport(f: FormData) {
  const u = await requireUser(["ADMIN"]); // provisional: restrictive default until OQ-19 is answered
  const [type, mode] = String(f.get("kind") || "").split(":") as [TemplateKey, "RECONCILIATION" | "HISTORICAL" | "NEW"];
  const file = f.get("file") as File | null;
  let err = "", id = "";
  try {
    const validMode =
      (type === "STOCK_COUNT" && mode === "RECONCILIATION") ||
      ((type === "PROCUREMENT" || type === "RECIPIENT") && (mode === "HISTORICAL" || mode === "NEW"));
    if (!(type in TEMPLATES) || !validMode) throw new Error("Choose a valid import type and mode.");
    if (!file || !file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Upload an .xlsx file.");
    if (file.size > 10 * 1024 * 1024) throw new Error("File is larger than 10 MB.");
    const buf = Buffer.from(await file.arrayBuffer());
    const checksum = createHash("sha256").update(buf).digest("hex");
    const idempotencyKey = createHash("sha256").update(`${type}:${mode}:${checksum}`).digest("hex");
    const dup = await db.importJob.findUnique({ where: { idempotencyKey } });
    if (dup) id = dup.id; // same file, type and mode: reuse the existing job
    else {
      const v = validateRows(type, await readFirstSheet(buf));
      const items = v.items ?? [];
      const invalid = items.filter((i) => i.errors.length).length;
      const duplicates = items.filter((i) => i.errors.some((e) => e.code === "DUPLICATE_ROW")).length;
      const status = v.headerError || invalid || !items.length ? "FAILED" : "VALIDATED";
      const errorSummary = v.headerError ?? (invalid ? `${invalid} row(s) have errors.` : items.length ? null : "No data rows.");
      const job = await db.$transaction(async (tx) => {
        const created = await tx.importJob.create({
          data: {
            type,
            mode,
            filename: file.name,
            checksum,
            idempotencyKey,
            uploadedById: u.id,
            totalRows: items.length,
            invalidRows: invalid,
            duplicateRows: duplicates,
            validRows: items.length - invalid,
            status,
            errorSummary,
          },
        });
        for (let i = 0; i < items.length; i += 1000) {
          await tx.importRow.createMany({
            data: items.slice(i, i + 1000).map((r) => ({
              jobId: created.id,
              sourceRow: r.n,
              raw: r.raw as any,
              errors: r.errors.length ? (r.errors as any) : undefined,
              status: r.errors.length ? "INVALID" : "VALID",
            })),
          });
        }
        await tx.auditLog.create({
          data: {
            actorId: u.id,
            action: "IMPORT_UPLOADED",
            entity: "ImportJob",
            entityId: created.id,
            detail: { type, mode, checksum, filename: file.name, totalRows: items.length, invalidRows: invalid, duplicateRows: duplicates },
          },
        });
        return created;
      });
      id = job.id;
    }
  } catch (e) { err = (e as Error).message; }
  redirect(err ? `/imports?error=${encodeURIComponent(err)}` : `/imports/${id}`);
}

function parseDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date in staged import row.");
  return date;
}

function quantity(value: unknown): string {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error("Quantity must be a non-negative whole number.");
  return String(n);
}

async function resolveRows(jobId: string, type: TemplateKey) {
  const rows = await db.importRow.findMany({ where: { jobId }, orderBy: { sourceRow: "asc" } });
  const items = await db.item.findMany({ where: { active: true }, include: { product: true } });
  const employees = type === "RECIPIENT" ? await db.employee.findMany({ where: { active: true } }) : [];
  const updates: { id: string; matchedItemId?: string; matchedEmployeeId?: string; normalized: object; errors: object[]; status: "VALID" | "INVALID" }[] = [];

  for (const row of rows) {
    const raw = row.raw as Record<string, unknown>;
    const product = normalizeProductFields(raw);
    const errors = Array.isArray(row.errors) ? [...(row.errors as object[])] : [];
    const candidates = items.filter((item) => {
      const productMatch =
        item.sku.toLowerCase() === product.product.toLowerCase() ||
        item.name.toLowerCase() === product.product.toLowerCase() ||
        item.product?.name.toLowerCase() === product.product.toLowerCase();
      return productMatch &&
        item.size.toLowerCase() === product.size.toLowerCase() &&
        item.color.toLowerCase() === product.color.toLowerCase() &&
        item.brand.toLowerCase() === product.brand.toLowerCase();
    });
    if (candidates.length !== 1) {
      errors.push({
        field: "Product",
        code: candidates.length ? "AMBIGUOUS_VARIANT" : "UNKNOWN_VARIANT",
        message: candidates.length ? "Product fields match more than one active variant." : "Product variant does not exist. Create it before importing.",
      });
    }

    let employeeId: string | undefined;
    if (type === "RECIPIENT") {
      const employee = employees.find((entry) => entry.empId.toLowerCase() === normalizeEmployeeFields(raw).empId.toLowerCase());
      if (!employee) {
        errors.push({ field: "Emp ID", code: "UNKNOWN_EMPLOYEE", message: "Employee Emp ID does not exist or is inactive." });
      } else {
        employeeId = employee.id;
        const identity = normalizeEmployeeFields(raw);
        if (identity.name && employee.name.toLowerCase() !== identity.name.toLowerCase())
          errors.push({ field: "Name", code: "EMPLOYEE_MISMATCH", message: "Name does not match the employee record." });
        if (identity.baseLocation && employee.baseLocation.toLowerCase() !== identity.baseLocation.toLowerCase())
          errors.push({ field: "Base Location", code: "EMPLOYEE_MISMATCH", message: "Base Location does not match the employee record." });
      }
    }

    updates.push({
      id: row.id,
      matchedItemId: candidates.length === 1 ? candidates[0].id : undefined,
      matchedEmployeeId: employeeId,
      normalized: { ...product, ...(type === "RECIPIENT" ? normalizeEmployeeFields(raw) : {}) },
      errors,
      status: errors.length ? "INVALID" : "VALID",
    });
  }
  return updates;
}

export async function prepareImport(f: FormData) {
  const u = await requireUser(["ADMIN"]);
  const id = String(f.get("id") || "");
  try {
    const job = await db.importJob.findUnique({ where: { id } });
    if (!job || job.status !== "VALIDATED") throw new Error("Only a validated import can be prepared.");
    const updates = await resolveRows(id, job.type);
    await db.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.importRow.update({
          where: { id: update.id },
          data: {
            matchedItemId: update.matchedItemId,
            matchedEmployeeId: update.matchedEmployeeId,
            normalized: update.normalized,
            errors: update.errors.length ? update.errors : undefined,
            status: update.status,
          },
        });
      }
      const invalidRows = updates.filter((row) => row.status === "INVALID").length;
      await tx.importJob.update({
        where: { id },
        data: {
          invalidRows,
          validRows: updates.length - invalidRows,
          status: invalidRows ? "FAILED" : job.type === "STOCK_COUNT" || job.mode === "NEW" ? "AWAITING_APPROVAL" : "VALIDATED",
          errorSummary: invalidRows ? `${invalidRows} row(s) need correction before commit.` : null,
        },
      });
      await tx.auditLog.create({
        data: { actorId: u.id, action: "IMPORT_PREPARED", entity: "ImportJob", entityId: id, correlationId: id, detail: { invalidRows } },
      });
    });
  } catch (e) {
    redirect(`/imports/${id}?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath(`/imports/${id}`);
  redirect(`/imports/${id}`);
}

export async function commitImport(f: FormData) {
  const u = await requireUser(["ADMIN"]);
  const id = String(f.get("id") || "");
  try {
    await db.$transaction(async (tx) => {
      const job = await tx.importJob.findUnique({ where: { id }, include: { rows: { orderBy: { sourceRow: "asc" } } } });
      if (!job || !["VALIDATED", "AWAITING_APPROVAL"].includes(job.status)) throw new Error("This import is not ready to commit.");
      if (job.rows.some((row) => row.status !== "VALID" || !row.matchedItemId)) throw new Error("Prepare the import and resolve every validation error first.");
      if (job.type === "STOCK_COUNT" || (job.type === "PROCUREMENT" && job.mode === "NEW")) {
        throw new Error("This import requires approval before stock can be posted.");
      }
      await tx.importJob.update({ where: { id }, data: { status: "COMMITTING" } });
      const recipientRequests = new Map<string, { employeeId: string; rows: typeof job.rows }>();
      for (const row of job.rows) {
        const raw = row.raw as Record<string, unknown>;
        if (job.type === "PROCUREMENT") {
          await tx.procurementRecord.create({
            data: {
              itemId: row.matchedItemId!,
              importJobId: id,
              sourceRow: row.sourceRow,
              mode: job.mode,
              procurementDate: parseDate(raw["Date"]),
              quantity: quantity(raw["Procured"]),
              status: "POSTED",
              sourceRef: `${job.checksum}:${row.sourceRow}`,
              reason: "Historical import; no stock effect",
            },
          });
        } else if (job.mode === "NEW") {
          const employeeId = row.matchedEmployeeId!;
          const existing = recipientRequests.get(employeeId);
          if (existing) existing.rows.push(row);
          else recipientRequests.set(employeeId, { employeeId, rows: [row] });
        } else {
          await tx.distributionRecord.create({
            data: {
              employeeId: row.matchedEmployeeId!,
              itemId: row.matchedItemId!,
              importJobId: id,
              sourceRow: row.sourceRow,
              mode: job.mode,
              distributionDate: parseDate(raw["Date"]),
              quantity: quantity(raw["Quantity"] || 0),
              category: String(raw["Category"] || ""),
              poc: String(raw["POC"] || ""),
              sourceStatus: String(raw["Status"] || ""),
              sourceRef: `${job.checksum}:${row.sourceRow}`,
            },
          });
        }
      }
      for (const group of recipientRequests.values()) {
        const request = await tx.request.create({
          data: {
            requesterId: job.uploadedById,
            status: "PENDING_MANAGER",
            levels: Number(process.env.APPROVAL_LEVELS) === 1 ? 1 : 2,
            purpose: `Recipient import ${job.filename} for employee ${group.employeeId}`,
            submittedAt: new Date(),
            importJobId: id,
            lines: {
              create: group.rows.map((row) => ({
                itemId: row.matchedItemId!,
                itemName: String((row.raw as Record<string, unknown>)["Product Details"] || (row.raw as Record<string, unknown>)["Product"]),
                quantity: quantity((row.raw as Record<string, unknown>)["Quantity"]),
              })),
            },
          },
        });
        for (const row of group.rows) {
          const raw = row.raw as Record<string, unknown>;
          await tx.distributionRecord.create({
            data: {
              employeeId: row.matchedEmployeeId!,
              itemId: row.matchedItemId!,
              importJobId: id,
              sourceRow: row.sourceRow,
              mode: job.mode,
              distributionDate: parseDate(raw["Date"]),
              quantity: quantity(raw["Quantity"]),
              category: String(raw["Category"] || ""),
              poc: String(raw["POC"] || ""),
              sourceStatus: String(raw["Status"] || ""),
              sourceRef: request.id,
            },
          });
        }
      }
      await tx.importJob.update({ where: { id }, data: { status: "COMMITTED", committedById: u.id, committedAt: new Date() } });
      await tx.auditLog.create({
        data: { actorId: u.id, action: "IMPORT_COMMITTED", entity: "ImportJob", entityId: id, correlationId: id, detail: { rows: job.rows.length, mode: job.mode } },
      });
    });
  } catch (e) {
    redirect(`/imports/${id}?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath(`/imports/${id}`);
  revalidatePath("/imports");
  redirect(`/imports/${id}`);
}

export async function approveImportStock(f: FormData) {
  const u = await requireUser(["MANAGER", "AUTHORITY"]);
  const id = String(f.get("id") || "");
  const approve = f.get("decision") === "approve";
  const reason = String(f.get("reason") || "").trim();
  try {
    if (!approve && !reason) throw new Error("Rejection reason is required.");
    await db.$transaction(async (tx) => {
      const job = await tx.importJob.findUnique({ where: { id }, include: { rows: true, reconciliations: true, procurements: true } });
      if (!job || job.status !== "AWAITING_APPROVAL") throw new Error("Import is not awaiting approval.");
      if (job.uploadedById === u.id) throw new Error("You cannot approve your own import.");
      if (job.type === "STOCK_COUNT") {
        const existingLedger = await tx.stockMovement.count();
        if (existingLedger === 0 && job.rows.some((row) => Number((row.raw as any).Available) < 0)) throw new Error("Initial stock cannot be negative.");
        for (const row of job.rows) {
          const raw = row.raw as Record<string, unknown>;
          const item = await tx.item.findUniqueOrThrow({ where: { id: row.matchedItemId! } });
          const target = quantity(raw["Available"]);
          const before = String(item.quantity);
          const variance = (Number(target) - Number(before)).toString();
          const review = await tx.reconciliationReview.create({
            data: {
              importJobId: id, itemId: item.id, sourceRow: row.sourceRow, balanceBefore: before,
              targetBalance: target, variance, procuredCheck: raw["Procured"] ? quantity(raw["Procured"]) : null,
              distributedCheck: raw["Distributed Qty"] ? quantity(raw["Distributed Qty"]) : null,
              requesterId: job.uploadedById, reviewerId: u.id, reviewedAt: new Date(),
              status: approve ? "APPROVED" : "REJECTED", reason: reason || "Approved stock count reconciliation",
            },
          });
          if (approve && Number(variance) !== 0) {
            const updated = await tx.item.updateMany({ where: { id: item.id, quantity: before }, data: { quantity: target } });
            if (!updated.count) throw new Error(`Stock changed while reviewing row ${row.sourceRow}; retry the review.`);
            await tx.stockMovement.create({
              data: {
                itemId: item.id, change: variance, balanceAfter: target, type: "RECONCILIATION_ADJUSTMENT",
                actorId: u.id, sourceType: "RECONCILIATION", sourceId: review.id,
                idempotencyKey: `reconciliation:${review.id}`, approvedById: u.id, approvedAt: new Date(), reason: reason || "Stock count reconciliation",
              },
            });
            await tx.reconciliationReview.update({ where: { id: review.id }, data: { status: "POSTED", movementId: (await tx.stockMovement.findFirstOrThrow({ where: { sourceId: review.id }, orderBy: { createdAt: "desc" } })).id } });
          }
        }
      } else {
        for (const row of job.rows) {
          const raw = row.raw as Record<string, unknown>;
          const record = await tx.procurementRecord.create({
            data: { itemId: row.matchedItemId!, importJobId: id, sourceRow: row.sourceRow, mode: job.mode, procurementDate: parseDate(raw["Date"]), quantity: quantity(raw["Procured"]), status: approve ? "APPROVED" : "REJECTED", approverId: u.id, approvedAt: new Date(), reason: reason || null, sourceRef: `${job.checksum}:${row.sourceRow}` },
          });
          if (approve) {
            const item = await tx.item.findUniqueOrThrow({ where: { id: record.itemId } });
            const updated = await tx.item.updateMany({ where: { id: item.id, quantity: item.quantity }, data: { quantity: { increment: record.quantity } } });
            if (!updated.count) throw new Error("Stock changed while approving procurement; retry the approval.");
            const after = await tx.item.findUniqueOrThrow({ where: { id: item.id } });
            await tx.stockMovement.create({ data: { itemId: item.id, change: record.quantity, balanceAfter: after.quantity, type: "PROCUREMENT_IN", actorId: u.id, sourceType: "PROCUREMENT", sourceId: record.id, idempotencyKey: `procurement:${record.id}`, approvedById: u.id, approvedAt: new Date() } });
            await tx.procurementRecord.update({ where: { id: record.id }, data: { status: "POSTED", movementId: (await tx.stockMovement.findFirstOrThrow({ where: { sourceId: record.id } })).id } });
          }
        }
      }
      await tx.importJob.update({ where: { id }, data: { status: approve ? "COMMITTED" : "FAILED", committedById: u.id, committedAt: new Date(), errorSummary: approve ? null : reason } });
      await tx.auditLog.create({ data: { actorId: u.id, action: approve ? "IMPORT_STOCK_APPROVED" : "IMPORT_STOCK_REJECTED", entity: "ImportJob", entityId: id, correlationId: id, detail: { reason } } });
    });
  } catch (e) {
    redirect(`/approvals?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/approvals");
  revalidatePath("/imports");
  revalidatePath(`/imports/${id}`);
  redirect("/approvals");
}
