"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, setSession } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Audit helper
// ---------------------------------------------------------------------------
const audit = (
  c: Pick<typeof db, "auditLog">,
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  detail?: object,
  outcome = "SUCCESS",
  correlationId?: string,
) =>
  c.auditLog.create({
    data: { actorId, action, entity, entityId, outcome, detail: detail as any, correlationId },
  });

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export async function login(f: FormData) {
  const u = await db.user.findUnique({
    where: { email: String(f.get("email")).trim().toLowerCase() },
  });
  if (!u || !u.active || !(await bcrypt.compare(String(f.get("password")), u.passwordHash)))
    redirect("/login?error=1");
  await setSession(u.id);
  await audit(db, u.id, "LOGIN", "User", u.id);
  redirect("/");
}

export async function logout() {
  cookies().delete("s");
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Items (product variants)
// ---------------------------------------------------------------------------
export async function createItem(f: FormData) {
  const u = await requireUser(["ADMIN"]);
  let err = "";
  try {
    const sku = String(f.get("sku") || "").trim();
    const name = String(f.get("name") || "").trim();
    const unit = String(f.get("unit") || "pcs").trim();
    const size = String(f.get("size") || "").trim();
    const color = String(f.get("color") || "").trim();
    const brand = String(f.get("brand") || "").trim();
    const category = String(f.get("category") || "General").trim();
    if (!sku || !name) throw new Error("SKU and name are required.");
    const i = await db.item.create({
      data: { sku, name, unit, size, color, brand, category },
    });
    // PTD-10: opening stock only via approved reconciliation — no stock written here.
    await audit(db, u.id, "ITEM_CREATED", "Item", i.id, { sku, name, size, color, brand });
  } catch (e) {
    err = (e as Error).message || "SKU already exists or fields are invalid";
  }
  if (err) redirect(`/inventory?error=${encodeURIComponent(err)}`);
  revalidatePath("/inventory");
}

// ---------------------------------------------------------------------------
// Requests (distribution)
// ---------------------------------------------------------------------------
async function submit(id: string, uid: string) {
  const levels = Number(process.env.APPROVAL_LEVELS) === 1 ? 1 : 2;
  const n = await db.request.updateMany({
    where: { id, requesterId: uid, status: "DRAFT" },
    data: { status: "PENDING_MANAGER", levels, submittedAt: new Date() },
  });
  if (n.count) await audit(db, uid, "REQUEST_SUBMITTED", "Request", id);
}

export async function createRequest(f: FormData) {
  const u = await requireUser(["EXECUTIVE"]);
  const m = new Map<string, number>();
  for (let i = 0; i < 10; i++) {
    const id = String(f.get(`item${i}`) || "");
    const q = Number(f.get(`qty${i}`));
    if (id && q > 0) m.set(id, (m.get(id) ?? 0) + q);
  }
  if (!m.size) redirect("/requests/new?error=Add at least one item with a quantity above zero");
  const items = await db.item.findMany({ where: { id: { in: [...m.keys()] }, active: true } });
  if (items.length !== m.size)
    redirect("/requests/new?error=One or more items are invalid or inactive");
  const r = await db.request.create({
    data: {
      requesterId: u.id,
      purpose: String(f.get("purpose") || ""),
      lines: {
        create: items.map((i) => ({ itemId: i.id, itemName: i.name, quantity: m.get(i.id)! })),
      },
    },
  });
  await audit(db, u.id, "REQUEST_CREATED", "Request", r.id);
  if (f.get("intent") === "submit") await submit(r.id, u.id);
  redirect(`/requests/${r.id}`);
}

export async function submitRequest(f: FormData) {
  const u = await requireUser(["EXECUTIVE"]);
  const id = String(f.get("id"));
  await submit(id, u.id);
  redirect(`/requests/${id}`);
}

// ---------------------------------------------------------------------------
// Approval — atomic stock deduction
// Commits or rolls back together. NEEDS_REVIEW on insufficient stock.
// ---------------------------------------------------------------------------
export async function decide(f: FormData) {
  const u = await requireUser(["MANAGER", "AUTHORITY"]);
  const id = String(f.get("id"));
  const approve = f.get("decision") === "approve";
  const remarks = String(f.get("remarks") || "").trim();
  let err = "";
  try {
    if (!approve && !remarks) throw new Error("Rejection remarks are required");
    await db.$transaction(async (tx) => {
      // Serialise concurrent/retried decisions on this request
      await tx.$queryRaw`SELECT id FROM "Request" WHERE id = ${id} FOR UPDATE`;
      const r = await tx.request.findUnique({
        where: { id },
        include: { lines: { orderBy: { itemId: "asc" } } },
      });
      const stage =
        r?.status === "PENDING_MANAGER" ? 1 : r?.status === "PENDING_AUTHORITY" ? 2 : 0;
      if (!r || !stage) throw new Error("This request is no longer awaiting approval");
      if (u.role !== (stage === 1 ? "MANAGER" : "AUTHORITY"))
        throw new Error("You are not the approver for this stage");
      if (r.requesterId === u.id) throw new Error("You cannot approve your own request");

      await tx.approval.create({
        data: {
          requestId: id,
          stage,
          approverId: u.id,
          approverName: u.name,
          decision: approve ? "APPROVED" : "REJECTED",
          remarks: remarks || null,
        },
      });

      if (!approve) {
        await tx.request.update({ where: { id }, data: { status: "REJECTED" } });
      } else if (stage < r.levels) {
        await tx.request.update({ where: { id }, data: { status: "PENDING_AUTHORITY" } });
      } else {
        // Final approval — attempt atomic stock deduction for all lines
        const insufficientLines: string[] = [];
        for (const l of r.lines) {
          const q = String(l.quantity);
          const rows = await tx.$queryRaw<{ quantity: string }[]>`
            UPDATE "Item" SET quantity = quantity - ${q}::numeric
            WHERE id = ${l.itemId} AND quantity >= ${q}::numeric
            RETURNING quantity::text
          `;
          if (!rows.length) {
            insufficientLines.push(l.itemName);
            continue;
          }
          await tx.stockMovement.create({
            data: {
              itemId: l.itemId,
              change: `-${q}`,
              balanceAfter: rows[0].quantity,
              type: "DISTRIBUTION_OUT",
              refId: id,
              actorId: u.id,
              sourceType: "REQUEST",
              sourceId: id,
              idempotencyKey: `dist:${id}:${l.itemId}`,
              approvedById: u.id,
              approvedAt: new Date(),
            },
          });
        }

        if (insufficientLines.length) {
          // Roll back the partial deductions by throwing — the tx will rollback
          // Then set NEEDS_REVIEW outside the rolled-back transaction
          throw Object.assign(
            new Error(`Insufficient stock for: ${insufficientLines.join(", ")}. No stock was deducted.`),
            { needsReview: true, reason: `Insufficient stock for: ${insufficientLines.join(", ")}` },
          );
        }

        await tx.request.update({ where: { id }, data: { status: "APPROVED" } });
      }

      await audit(
        tx as any,
        u.id,
        approve ? `REQUEST_APPROVED_S${stage}` : `REQUEST_REJECTED_S${stage}`,
        "Request",
        id,
      );
    });
  } catch (e: any) {
    if (e.needsReview) {
      // Transaction rolled back; now mark as NEEDS_REVIEW outside transaction
      await db.request.updateMany({
        where: { id, status: { in: ["PENDING_MANAGER", "PENDING_AUTHORITY"] } },
        data: { status: "NEEDS_REVIEW", reviewReason: e.reason },
      });
      await audit(db, u.id, "REQUEST_NEEDS_REVIEW", "Request", id, { reason: e.reason });
      revalidatePath("/approvals");
      redirect(`/approvals?error=${encodeURIComponent(e.message)}`);
    }
    err = e.message;
  }
  revalidatePath("/approvals");
  redirect(err ? `/approvals?error=${encodeURIComponent(err)}` : "/approvals");
}

// ---------------------------------------------------------------------------
// NEEDS_REVIEW resolution
// OQ-27: reviewer role, assignment and extended outcomes are OPEN.
// Safe subset: requeue to PENDING_MANAGER (no stock effect) or reject.
// Self-resolution is blocked server-side matching existing self-approval guard.
// ---------------------------------------------------------------------------
export async function resolveNeedsReview(f: FormData) {
  const u = await requireUser(["MANAGER", "AUTHORITY"]);
  const id = String(f.get("id"));
  const decision = f.get("decision");
  const remarks = String(f.get("remarks") || "").trim();
  let err = "";
  try {
    if (decision !== "requeue" && decision !== "reject") throw new Error("Invalid decision.");
    if (decision === "reject" && !remarks) throw new Error("Rejection remarks are required.");

    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Request" WHERE id = ${id} FOR UPDATE`;
      const r = await tx.request.findUnique({ where: { id, status: "NEEDS_REVIEW" } });
      if (!r) throw new Error("Request is not in NEEDS_REVIEW, or does not exist.");
      if (r.requesterId === u.id) throw new Error("You cannot resolve your own request.");

      if (decision === "requeue") {
        const levels = r.levels ?? 2;
        await tx.request.update({
          where: { id },
          data: { status: "PENDING_MANAGER", reviewReason: null },
        });
        await audit(tx as any, u.id, "REQUEST_REQUEUED", "Request", id, {
          reviewedBy: u.id,
          remarks: remarks || null,
          levels,
        });
      } else {
        await tx.request.update({
          where: { id },
          data: { status: "REJECTED" },
        });
        await tx.approval.create({
          data: {
            requestId: id,
            stage: 99, // sentinel for review-rejection
            approverId: u.id,
            approverName: u.name,
            decision: "REJECTED",
            remarks: remarks || null,
          },
        });
        await audit(tx as any, u.id, "REQUEST_REVIEW_REJECTED", "Request", id, {
          remarks,
        });
      }
    });
  } catch (e: any) {
    err = e.message;
  }
  revalidatePath("/approvals");
  revalidatePath("/requests");
  if (err) redirect(`/requests/${id}/review?error=${encodeURIComponent(err)}`);
  redirect("/requests");
}

// ---------------------------------------------------------------------------
// User management (ADMIN only)
// ---------------------------------------------------------------------------
export async function toggleUser(f: FormData) {
  const u = await requireUser(["ADMIN"]);
  const id = String(f.get("id"));
  const active = f.get("active") === "1";
  if (id === u.id) redirect("/users?error=You cannot deactivate your own account");
  const updated = await db.user.updateMany({ where: { id }, data: { active: !active } });
  if (updated.count) {
    await audit(db, u.id, active ? "USER_DEACTIVATED" : "USER_ACTIVATED", "User", id);
  }
  revalidatePath("/users");
}

function userInput(f: FormData) {
  const name = String(f.get("name") || "").trim();
  const email = String(f.get("email") || "").trim().toLowerCase();
  const role = String(f.get("role") || "");
  const password = String(f.get("password") || "");
  if (!name) throw new Error("Name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (!["EXECUTIVE", "MANAGER", "AUTHORITY", "ADMIN"].includes(role)) throw new Error("Select a valid role.");
  if (password && password.length < 8) throw new Error("Password must be at least 8 characters.");
  return { name, email, role: role as "EXECUTIVE" | "MANAGER" | "AUTHORITY" | "ADMIN", password };
}

export async function createUser(f: FormData) {
  const actor = await requireUser(["ADMIN"]);
  try {
    const input = userInput(f);
    if (!input.password) throw new Error("Password is required for a new user.");
    const created = await db.user.create({
      data: {
        name: input.name,
        email: input.email,
        role: input.role,
        passwordHash: await bcrypt.hash(input.password, 12),
      },
    });
    await audit(db, actor.id, "USER_CREATED", "User", created.id, { email: created.email, role: created.role });
  } catch (e) {
    redirect(`/users?error=${encodeURIComponent((e as Error).message || "Unable to create user.")}`);
  }
  revalidatePath("/users");
}

export async function updateUser(f: FormData) {
  const actor = await requireUser(["ADMIN"]);
  const id = String(f.get("id") || "");
  try {
    if (!id) throw new Error("User was not specified.");
    const input = userInput(f);
    const data: { name: string; email: string; role: typeof input.role; passwordHash?: string } = {
      name: input.name,
      email: input.email,
      role: input.role,
    };
    if (input.password) data.passwordHash = await bcrypt.hash(input.password, 12);
    const updated = await db.user.update({ where: { id }, data });
    await audit(db, actor.id, "USER_UPDATED", "User", id, { email: updated.email, role: updated.role, passwordChanged: Boolean(input.password) });
  } catch (e) {
    redirect(`/users?error=${encodeURIComponent((e as Error).message || "Unable to update user.")}`);
  }
  revalidatePath("/users");
}

export async function deleteUser(f: FormData) {
  const actor = await requireUser(["ADMIN"]);
  const id = String(f.get("id") || "");
  if (id === actor.id) redirect("/users?error=You cannot delete your own account.");
  try {
    await db.user.delete({ where: { id } });
    await audit(db, actor.id, "USER_DELETED", "User", id);
  } catch {
    redirect("/users?error=This user has related business history and cannot be deleted. Deactivate the account instead.");
  }
  revalidatePath("/users");
}
