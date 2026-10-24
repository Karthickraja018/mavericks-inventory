"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function createEmployee(f: FormData) {
  const u = await requireUser(["ADMIN"]);
  let err = "";
  try {
    const empId = String(f.get("empId") || "").trim();
    const name = String(f.get("name") || "").trim();
    const baseLocation = String(f.get("baseLocation") || "").trim();
    if (!empId || !name) throw new Error("Emp ID and Name are required.");
    const e = await db.employee.create({ data: { empId, name, baseLocation } });
    await db.auditLog.create({
      data: { actorId: u.id, action: "EMPLOYEE_CREATED", entity: "Employee", entityId: e.id, detail: { empId, name } },
    });
  } catch (e: any) {
    err = e.message || "Emp ID already exists or fields are invalid.";
  }
  if (err) redirect(`/employees?error=${encodeURIComponent(err)}`);
  revalidatePath("/employees");
}

export async function toggleEmployee(f: FormData) {
  const u = await requireUser(["ADMIN"]);
  const id = String(f.get("id"));
  const active = f.get("active") === "1";
  await db.employee.update({ where: { id }, data: { active: !active } });
  await db.auditLog.create({
    data: { actorId: u.id, action: active ? "EMPLOYEE_DEACTIVATED" : "EMPLOYEE_ACTIVATED", entity: "Employee", entityId: id },
  });
  revalidatePath("/employees");
}

export async function updateEmployee(f: FormData) {
  const u = await requireUser(["ADMIN"]);
  const id = String(f.get("id") || "");
  const name = String(f.get("name") || "").trim();
  const baseLocation = String(f.get("baseLocation") || "").trim();
  if (!id || !name) redirect("/employees?error=Employee ID and name are required.");
  try {
    await db.employee.update({ where: { id }, data: { name, baseLocation } });
    await db.auditLog.create({ data: { actorId: u.id, action: "EMPLOYEE_UPDATED", entity: "Employee", entityId: id, detail: { name, baseLocation } } });
  } catch (e) {
    redirect(`/employees?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/employees");
  redirect("/employees");
}
