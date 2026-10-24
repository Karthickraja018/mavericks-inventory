import ExcelJS from "exceljs";
import { Readable } from "stream";

// ---------------------------------------------------------------------------
// Template definitions
// Column sets match the supplied BRD templates exactly.
// Required-field choices are from confirmed decisions (IMP-009, BRD §23).
// ---------------------------------------------------------------------------
export const TEMPLATES = {
  STOCK_COUNT: {
    cols: ["S.N", "Product Details", "Product", "Size / Quantity", "Color", "Brand", "Procured", "Distributed Qty", "Available"],
    req: ["Product"],
    ints: ["Procured", "Distributed Qty", "Available"],
    dates: [] as string[],
  },
  PROCUREMENT: {
    cols: ["Date", "Product Details", "Product", "Size / Quantity", "Color", "Brand", "Procured"],
    req: ["Product"],
    ints: ["Procured"],
    dates: ["Date"],
  },
  RECIPIENT: {
    cols: ["Date", "Emp ID", "Name", "Base Location", "Category", "POC", "Product Details", "Product", "Size / Quantity", "Color", "Brand", "Status", "Quantity"],
    req: ["Emp ID", "Product", "Quantity"],
    ints: ["Quantity"],
    dates: ["Date"],
  },
} as const;

export type TemplateKey = keyof typeof TEMPLATES;
export type RowErr = { field: string; code: string; message: string };

// ---------------------------------------------------------------------------
// Cell value extraction (handles ExcelJS rich text, formula results, etc.)
// ---------------------------------------------------------------------------
function val(x: any): string | number | Date {
  if (x && typeof x === "object" && !(x instanceof Date))
    x = "result" in x ? x.result : "richText" in x ? x.richText.map((r: any) => r.text).join("") : x.text;
  if (x == null) return "";
  if (x instanceof Date || typeof x === "number") return x;
  return String(x).replace(/\s+/g, " ").trim();
}

const cells = (v: unknown[]) => {
  const c = Array.from(v, val);
  while (c.length && c[c.length - 1] === "") c.pop();
  return c;
};

const validDate = (x: unknown) =>
  (x instanceof Date && !isNaN(+x)) ||
  (typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) && !isNaN(Date.parse(x)));

// ---------------------------------------------------------------------------
// Canonical normalization (OQ-15 conservative treatment)
// NA, N/A, n/a, na → canonical empty string (not applicable)
// Leading/trailing whitespace removed; internal whitespace collapsed.
// ---------------------------------------------------------------------------
export function canonicalize(s: unknown): string {
  const str = String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (/^(na|n\/a)$/i.test(str)) return "";
  return str;
}

// ---------------------------------------------------------------------------
// Streaming XLSX parser — returns all rows from the first sheet
// ---------------------------------------------------------------------------
export async function readFirstSheet(buf: Buffer) {
  const wb = new (ExcelJS as any).stream.xlsx.WorkbookReader(Readable.from(buf), {
    sharedStrings: "cache",
    styles: "cache",
    worksheets: "emit",
    entries: "emit",
  });
  for await (const ws of wb) {
    const rows: { n: number; v: unknown[] }[] = [];
    for await (const row of ws) rows.push({ n: row.number, v: (row.values as unknown[]).slice(1) });
    return rows;
  }
  return [];
}

// ---------------------------------------------------------------------------
// Row validation — structural only (no DB lookups)
// Returns headerError OR items array.
// ---------------------------------------------------------------------------
export function validateRows(type: TemplateKey, rows: { n: number; v: unknown[] }[]) {
  const t = TEMPLATES[type];
  if (!rows.length) return { headerError: "The file is empty." };

  const head = cells(rows[0].v).map((x) => String(x).toLowerCase());
  // For RECIPIENT, accept both the 12-column legacy format (without Quantity) and the
  // 13-column updated format. If Quantity is absent, flag it as a warning but allow
  // structural validation to continue so the import can be staged.
  const expectCols = [...t.cols];
  const recipientLegacy =
    type === "RECIPIENT" &&
    head.length === 12 &&
    expectCols.slice(0, 12).every((c, i) => c.toLowerCase() === head[i]);

  if (!recipientLegacy) {
    if (
      head.length !== expectCols.length ||
      expectCols.some((c, i) => c.toLowerCase() !== head[i])
    )
      return { headerError: `Columns must be, in order: ${expectCols.join(", ")}` };
  }

  // Build must-validate set: required fields + numeric fields + date fields
  const must: string[] = [...t.req, ...t.ints, ...t.dates];

  const items: { n: number; raw: Record<string, unknown>; errors: RowErr[] }[] = [];

  // Intra-file duplicate detection: track (Product, Date or S.N, qty) combos seen so far.
  // This is a provisional check only (OQ-7). A stable source ID takes priority when available.
  const seenKeys = new Set<string>();

  for (const r of rows.slice(1)) {
    const c = cells(r.v);
    if (c.every((x) => x === "")) continue;

    const raw: Record<string, unknown> = {};
    const errors: RowErr[] = [];
    const usedCols = recipientLegacy ? expectCols.slice(0, 12) : expectCols;
    usedCols.forEach((col, i) => (raw[col] = c[i] ?? ""));
    if (recipientLegacy) {
      raw["Quantity"] = ""; // missing — add warning
      errors.push({
        field: "Quantity",
        code: "MISSING_QUANTITY_COLUMN",
        message: "Recipient template is missing the Quantity column. Add it per the updated template.",
      });
    }

    const e = (code: string, field: string, message: string) => errors.push({ field, code, message });

    for (const col of usedCols as readonly string[]) {
      if (!must.includes(col)) continue;
      const x = raw[col];
      const s = String(x);

      if (s === "") {
        if (col === "Quantity" && recipientLegacy) {
          e("MISSING_QUANTITY_COLUMN", col, "Recipient template is missing the Quantity column. Add it per the updated template.");
        } else {
          e("MISSING_REQUIRED", col, "A value is required.");
        }
      } else if (typeof x === "string" && x.toUpperCase() === "XXX") {
        e("PLACEHOLDER_VALUE", col, "XXX is a placeholder, not a value.");
      } else if (
        t.ints.includes(col as never) &&
        !(typeof x === "number" ? Number.isInteger(x) && x >= 0 : /^\d+$/.test(s))
      ) {
        e("INVALID_INTEGER", col, "Must be a whole number, zero or more.");
      } else if (t.dates.includes(col as never) && !validDate(x)) {
        e("INVALID_DATE", col, "Use a date cell or YYYY-MM-DD.");
      }
    }

    // Intra-file duplicate check (provisional — OQ-7)
    if (errors.length === 0) {
      const product = canonicalize(raw["Product"]);
      const size = canonicalize(raw["Size / Quantity"]);
      const color = canonicalize(raw["Color"]);
      const brand = canonicalize(raw["Brand"]);
      const dateKey =
        type === "STOCK_COUNT"
          ? String(raw["S.N"] ?? r.n)
          : String(raw["Date"] ?? "");
      const qtyKey =
        type === "STOCK_COUNT"
          ? String(raw["Available"] ?? "")
          : String(raw["Procured"] ?? raw["Quantity"] ?? "");
      const dk = `${type}|${product}|${size}|${color}|${brand}|${dateKey}|${qtyKey}`;
      if (seenKeys.has(dk)) {
        errors.push({
          field: "Product",
          code: "DUPLICATE_ROW",
          message: `This row appears to be a duplicate of an earlier row in the same file.`,
        });
      } else {
        seenKeys.add(dk);
      }
    }

    items.push({ n: r.n, raw, errors });
  }

  return { items };
}

// ---------------------------------------------------------------------------
// Variant matching helpers (DB-aware — called from server actions, not here)
// These exported functions process a single raw row's normalized fields.
// ---------------------------------------------------------------------------

/** Normalize a row's product fields into a lookup-ready structure. */
export function normalizeProductFields(raw: Record<string, unknown>) {
  return {
    product: canonicalize(raw["Product"]),
    size: canonicalize(raw["Size / Quantity"]),
    color: canonicalize(raw["Color"]),
    brand: canonicalize(raw["Brand"]),
    productDetails: canonicalize(raw["Product Details"]),
  };
}

/** Normalize a row's employee fields for lookup. */
export function normalizeEmployeeFields(raw: Record<string, unknown>) {
  return {
    empId: String(raw["Emp ID"] ?? "").trim(),
    name: canonicalize(raw["Name"]),
    baseLocation: canonicalize(raw["Base Location"]),
  };
}
