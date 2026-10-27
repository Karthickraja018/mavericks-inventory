"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseEmployeeWorkbook } from "@/lib/employee-excel";

export async function createEmployee(f: FormData) {
  const u = await requireUser(["ADMIN", "EXECUTIVE", "MANAGER"]);
  let err = "";
  try {
    const empId = String(f.get("empId") || "").trim().toUpperCase();
    const name = String(f.get("name") || "").trim();
    const baseLocation = String(f.get("baseLocation") || "").trim() || "HQ";
    const department = String(f.get("department") || "").trim() || null;
    const email = String(f.get("email") || "").trim() || null;
    if (!empId || !name) throw new Error("Emp ID and Name are required.");

    const existing = await db.employee.findUnique({ where: { empId } });
    if (existing) throw new Error(`Employee ID ${empId} already exists (${existing.name}).`);

    const e = await db.employee.create({
      data: { empId, name, baseLocation, department, email },
    });
    await db.auditLog.create({
      data: {
        actorId: u.id,
        action: "EMPLOYEE_CREATED",
        entity: "Employee",
        entityId: e.id,
        detail: { empId, name, baseLocation, department, email },
      },
    });
  } catch (e: any) {
    err = e.message || "Emp ID already exists or fields are invalid.";
  }
  if (err) redirect(`/employees?error=${encodeURIComponent(err)}`);
  revalidatePath("/employees");
  redirect("/employees?success=Employee added successfully.");
}

export async function toggleEmployee(f: FormData) {
  const u = await requireUser(["ADMIN", "MANAGER"]);
  const id = String(f.get("id"));
  const active = f.get("active") === "1";
  await db.employee.update({ where: { id }, data: { active: !active } });
  await db.auditLog.create({
    data: {
      actorId: u.id,
      action: active ? "EMPLOYEE_DEACTIVATED" : "EMPLOYEE_ACTIVATED",
      entity: "Employee",
      entityId: id,
    },
  });
  revalidatePath("/employees");
  redirect("/employees");
}

export async function updateEmployee(f: FormData) {
  const u = await requireUser(["ADMIN", "EXECUTIVE", "MANAGER"]);
  const id = String(f.get("id") || "");
  const name = String(f.get("name") || "").trim();
  const baseLocation = String(f.get("baseLocation") || "").trim() || "HQ";
  const department = String(f.get("department") || "").trim() || null;
  const email = String(f.get("email") || "").trim() || null;
  if (!id || !name) redirect("/employees?error=Employee ID and name are required.");
  try {
    await db.employee.update({
      where: { id },
      data: { name, baseLocation, department, email },
    });
    await db.auditLog.create({
      data: {
        actorId: u.id,
        action: "EMPLOYEE_UPDATED",
        entity: "Employee",
        entityId: id,
        detail: { name, baseLocation, department, email },
      },
    });
  } catch (e) {
    redirect(`/employees?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/employees");
  redirect("/employees?success=Employee updated successfully.");
}

export async function importEmployeesExcel(f: FormData) {
  const u = await requireUser(["ADMIN", "EXECUTIVE", "MANAGER"]);
  const file = f.get("file") as File | null;
  let err = "";
  let message = "";

  try {
    if (!file || !file.name) {
      throw new Error("Please select an Excel (.xlsx) file to upload.");
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      throw new Error("Invalid file format. Please upload an Excel .xlsx workbook.");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("File exceeds 10 MB limit.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseEmployeeWorkbook(buffer);

    if (result.employees.length === 0) {
      throw new Error("No valid employee rows found in the Excel sheet.");
    }

    let createdCount = 0;
    let updatedCount = 0;

    // Upsert employees in transaction batches
    await db.$transaction(async (tx) => {
      for (const item of result.employees) {
        const existing = await tx.employee.findUnique({ where: { empId: item.empId } });
        if (existing) {
          await tx.employee.update({
            where: { id: existing.id },
            data: {
              name: item.name,
              baseLocation: item.baseLocation || existing.baseLocation,
              department: item.department || existing.department,
              email: item.email || existing.email,
              active: true,
            },
          });
          updatedCount++;
        } else {
          await tx.employee.create({
            data: {
              empId: item.empId,
              name: item.name,
              baseLocation: item.baseLocation || "HQ",
              department: item.department || null,
              email: item.email || null,
              active: true,
            },
          });
          createdCount++;
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: u.id,
          action: "EMPLOYEES_IMPORTED_EXCEL",
          entity: "Employee",
          entityId: "BULK_IMPORT",
          detail: {
            filename: file.name,
            totalParsed: result.employees.length,
            created: createdCount,
            updated: updatedCount,
            errorsCount: result.errors.length,
          },
        },
      });
    });

    message = `Successfully imported ${result.employees.length} employees (${createdCount} new, ${updatedCount} updated).`;
    if (result.errors.length > 0) {
      message += ` Note: ${result.errors.length} warning(s)/skipped rows.`;
    }
  } catch (e: any) {
    err = e.message || "Failed to parse and import employee Excel file.";
  }

  if (err) {
    redirect(`/employees?error=${encodeURIComponent(err)}`);
  }
  revalidatePath("/employees");
  redirect(`/employees?success=${encodeURIComponent(message)}`);
}
