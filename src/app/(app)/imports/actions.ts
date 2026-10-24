"use server";
import { createHash } from "crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readFirstSheet, validateRows, TEMPLATES, TemplateKey } from "@/lib/imports";

// Gate 2: upload, parse, validate, stage. Writes ONLY to ImportJob/ImportRow (staging). No stock or business effect.
export async function uploadImport(f: FormData) {
  const u = await requireUser(["ADMIN"]); // provisional: restrictive default until OQ-19 is answered
  const [type, mode] = String(f.get("kind") || "").split(":") as [TemplateKey, "RECONCILIATION" | "HISTORICAL" | "NEW"];
  const file = f.get("file") as File | null;
  let err = "", id = "";
  try {
    if (!(type in TEMPLATES) || !mode) throw new Error("Choose the import type and mode.");
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
      const job = await db.importJob.create({ data: { type, mode, filename: file.name, checksum, idempotencyKey, uploadedById: u.id, totalRows: items.length, invalidRows: invalid, validRows: items.length - invalid, status: v.headerError || invalid || !items.length ? "FAILED" : "VALIDATED", errorSummary: v.headerError ?? (invalid ? `${invalid} row(s) have errors.` : items.length ? null : "No data rows.") } });
      for (let i = 0; i < items.length; i += 1000)
        await db.importRow.createMany({ data: items.slice(i, i + 1000).map((r) => ({ jobId: job.id, sourceRow: r.n, raw: r.raw as any, errors: r.errors.length ? (r.errors as any) : undefined, status: r.errors.length ? "INVALID" : "VALID" })) });
      await db.auditLog.create({ data: { actorId: u.id, action: "IMPORT_UPLOADED", entity: "ImportJob", entityId: job.id, detail: { type, mode, checksum, filename: file.name, totalRows: items.length, invalidRows: invalid } } });
      id = job.id;
    }
  } catch (e) { err = (e as Error).message; }
  redirect(err ? `/imports?error=${encodeURIComponent(err)}` : `/imports/${id}`);
}
