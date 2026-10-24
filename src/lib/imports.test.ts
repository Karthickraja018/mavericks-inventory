import test from "node:test";
import assert from "node:assert/strict";
import { validateRows, TEMPLATES, canonicalize, normalizeProductFields, normalizeEmployeeFields } from "./imports";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
const procHead = { n: 1, v: [...TEMPLATES.PROCUREMENT.cols] };
const scHead = { n: 1, v: [...TEMPLATES.STOCK_COUNT.cols] };
const recipientHead = { n: 1, v: [...TEMPLATES.RECIPIENT.cols] };

// ---------------------------------------------------------------------------
// 1. Header validation
// ---------------------------------------------------------------------------
test("header mismatch is rejected", () =>
  assert.ok(validateRows("PROCUREMENT", [{ n: 1, v: ["Date", "Item"] }]).headerError));

test("wrong number of columns is rejected", () =>
  assert.ok(validateRows("PROCUREMENT", [{ n: 1, v: ["Date"] }]).headerError));

test("valid procurement header passes", () =>
  assert.ok(!validateRows("PROCUREMENT", [procHead]).headerError));

test("valid stock-count header passes", () =>
  assert.ok(!validateRows("STOCK_COUNT", [scHead]).headerError));

test("valid recipient header (13 cols) passes", () =>
  assert.ok(!validateRows("RECIPIENT", [recipientHead]).headerError));

test("recipient legacy header (12 cols without Quantity) passes with warning", () => {
  const legacyHead = { n: 1, v: TEMPLATES.RECIPIENT.cols.slice(0, 12) };
  const result = validateRows("RECIPIENT", [
    legacyHead,
    { n: 2, v: ["2025-01-01", "E001", "Alice", "HQ", "", "", "", "Widget", "M", "Red", "Brand", "Distributed"] },
  ]);
  assert.ok(!result.headerError);
  const errors = result.items![0].errors;
  assert.ok(errors.some((e) => e.code === "MISSING_QUANTITY_COLUMN"), "should flag missing Quantity column");
});

// ---------------------------------------------------------------------------
// 2. Valid rows
// ---------------------------------------------------------------------------
test("valid procurement row passes", () =>
  assert.equal(
    validateRows("PROCUREMENT", [procHead, { n: 2, v: ["2025-01-31", "", "Gloves", "", "", "", 10] }]).items![0].errors.length,
    0,
  ));

test("valid stock count row passes", () =>
  assert.equal(
    validateRows("STOCK_COUNT", [scHead, { n: 2, v: [1, "", "Widget", "M", "Blue", "Brand", 100, 50, 80] }]).items![0].errors.length,
    0,
  ));

test("empty rows are skipped", () => {
  const result = validateRows("PROCUREMENT", [procHead, { n: 2, v: [] }, { n: 3, v: ["2025-01-31", "", "Gloves", "", "", "", 10] }]);
  assert.equal(result.items!.length, 1);
  assert.equal(result.items![0].n, 3);
});

// ---------------------------------------------------------------------------
// 3. Error codes
// ---------------------------------------------------------------------------
test("XXX in date and bad quantity are flagged", () => {
  const e = validateRows("PROCUREMENT", [procHead, { n: 2, v: ["XXX", "", "Gloves", "", "", "", "1.5"] }]).items![0].errors.map((x) => x.code);
  assert.deepEqual(e, ["PLACEHOLDER_VALUE", "INVALID_INTEGER"]);
});

test("blank numeric is MISSING_REQUIRED", () =>
  assert.equal(
    validateRows("PROCUREMENT", [procHead, { n: 2, v: ["2025-01-31", "", "Gloves"] }]).items![0].errors[0].code,
    "MISSING_REQUIRED",
  ));

test("invalid date is flagged", () =>
  assert.ok(
    validateRows("PROCUREMENT", [procHead, { n: 2, v: ["not-a-date", "", "Gloves", "", "", "", 5] }]).items![0].errors.some(
      (e) => e.code === "INVALID_DATE",
    ),
  ));

test("decimal quantity is INVALID_INTEGER", () =>
  assert.ok(
    validateRows("PROCUREMENT", [procHead, { n: 2, v: ["2025-01-01", "", "Widget", "", "", "", 1.5] }]).items![0].errors.some(
      (e) => e.code === "INVALID_INTEGER",
    ),
  ));

test("negative quantity is INVALID_INTEGER", () =>
  assert.ok(
    validateRows("PROCUREMENT", [procHead, { n: 2, v: ["2025-01-01", "", "Widget", "", "", "", -1] }]).items![0].errors.some(
      (e) => e.code === "INVALID_INTEGER",
    ),
  ));

test("zero quantity is valid", () =>
  assert.equal(
    validateRows("PROCUREMENT", [procHead, { n: 2, v: ["2025-01-01", "", "Widget", "", "", "", 0] }]).items![0].errors.length,
    0,
  ));

// ---------------------------------------------------------------------------
// 4. Intra-file duplicate detection
// ---------------------------------------------------------------------------
test("identical rows in one file → second flagged as DUPLICATE_ROW", () => {
  const row = { n: 2, v: ["2025-01-31", "", "Gloves", "M", "Blue", "Brand", 10] };
  const row2 = { n: 3, v: ["2025-01-31", "", "Gloves", "M", "Blue", "Brand", 10] };
  const items = validateRows("PROCUREMENT", [procHead, row, row2]).items!;
  assert.equal(items[0].errors.length, 0, "first row should be valid");
  assert.ok(items[1].errors.some((e) => e.code === "DUPLICATE_ROW"), "second row should be flagged");
});

test("different products in one file are not duplicates", () => {
  const row1 = { n: 2, v: ["2025-01-31", "", "Gloves", "M", "Blue", "Brand", 10] };
  const row2 = { n: 3, v: ["2025-01-31", "", "Helmet", "M", "Blue", "Brand", 10] };
  const items = validateRows("PROCUREMENT", [procHead, row1, row2]).items!;
  assert.equal(items[0].errors.length, 0);
  assert.equal(items[1].errors.length, 0);
});

// ---------------------------------------------------------------------------
// 5. Source row number preservation
// ---------------------------------------------------------------------------
test("source row numbers match original Excel row numbers", () => {
  const items = validateRows("PROCUREMENT", [
    procHead,
    { n: 5, v: ["2025-01-31", "", "Widget", "", "", "", 10] },
  ]).items!;
  assert.equal(items[0].n, 5);
});

// ---------------------------------------------------------------------------
// 6. Canonicalization
// ---------------------------------------------------------------------------
test("canonicalize: NA → empty string", () => assert.equal(canonicalize("NA"), ""));
test("canonicalize: N/A → empty string", () => assert.equal(canonicalize("N/A"), ""));
test("canonicalize: n/a → empty string", () => assert.equal(canonicalize("n/a"), ""));
test("canonicalize: na → empty string", () => assert.equal(canonicalize("na"), ""));
test("canonicalize: blank → empty string", () => assert.equal(canonicalize(""), ""));
test("canonicalize: null → empty string", () => assert.equal(canonicalize(null), ""));
test("canonicalize: real value preserved", () => assert.equal(canonicalize("Large"), "Large"));
test("canonicalize: trims whitespace", () => assert.equal(canonicalize("  Blue  "), "Blue"));
test("canonicalize: collapses internal whitespace", () => assert.equal(canonicalize("Light  Blue"), "Light Blue"));

// ---------------------------------------------------------------------------
// 7. Normalize helpers
// ---------------------------------------------------------------------------
test("normalizeProductFields extracts expected keys", () => {
  const raw = { "Product": "T-Shirt", "Size / Quantity": "L", "Color": "Ash", "Brand": "Crocodile", "Product Details": "apparel" };
  const n = normalizeProductFields(raw);
  assert.equal(n.product, "T-Shirt");
  assert.equal(n.size, "L");
  assert.equal(n.color, "Ash");
  assert.equal(n.brand, "Crocodile");
});

test("normalizeProductFields: NA color → empty string", () => {
  const raw = { "Product": "Mug", "Size / Quantity": "NA", "Color": "N/A", "Brand": "NA", "Product Details": "" };
  const n = normalizeProductFields(raw);
  assert.equal(n.size, "");
  assert.equal(n.color, "");
  assert.equal(n.brand, "");
});

test("normalizeEmployeeFields extracts empId", () => {
  const raw = { "Emp ID": "  E001  ", "Name": "Alice", "Base Location": "HQ" };
  const n = normalizeEmployeeFields(raw);
  assert.equal(n.empId, "E001");
  assert.equal(n.name, "Alice");
  assert.equal(n.baseLocation, "HQ");
});

// ---------------------------------------------------------------------------
// 8. Stock Count specific rules
// ---------------------------------------------------------------------------
test("Stock Count: Available is required", () => {
  const item = validateRows("STOCK_COUNT", [scHead, { n: 2, v: [1, "", "Widget", "", "", "", 10, 5] }]).items![0];
  assert.ok(item.errors.some((e) => e.field === "Available" && e.code === "MISSING_REQUIRED"));
});

test("Stock Count: valid row with all numeric fields", () => {
  const item = validateRows("STOCK_COUNT", [scHead, { n: 2, v: [1, "detail", "Widget", "L", "Blue", "Brand", 100, 50, 80] }]).items![0];
  assert.equal(item.errors.length, 0);
});
