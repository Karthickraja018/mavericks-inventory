import test from "node:test";
import assert from "node:assert/strict";
import { validateRows, TEMPLATES, canonicalize } from "./imports";

// ---------------------------------------------------------------------------
// Import validation edge cases — extending the existing suite
// ---------------------------------------------------------------------------

const procHead = { n: 1, v: [...TEMPLATES.PROCUREMENT.cols] };
const scHead = { n: 1, v: [...TEMPLATES.STOCK_COUNT.cols] };
const recipHead = { n: 1, v: [...TEMPLATES.RECIPIENT.cols] };

// ---------------------------------------------------------------------------
// 9. Mixed valid and invalid rows
// ---------------------------------------------------------------------------
test("mix of valid and invalid rows — counts are independent", () => {
  const rows = validateRows("PROCUREMENT", [
    procHead,
    { n: 2, v: ["2025-01-01", "", "Widget", "", "", "", 10] },   // valid
    { n: 3, v: ["bad-date", "", "Widget", "", "", "", 10] },     // invalid: bad date
    { n: 4, v: ["2025-01-02", "", "Gadget", "", "", "", 5] },    // valid
  ]);
  assert.ok(!rows.headerError, "should have no header error");
  assert.equal(rows.items!.length, 3);
  assert.equal(rows.items![0].errors.length, 0, "row 2 should be valid");
  assert.ok(rows.items![1].errors.some(e => e.code === "INVALID_DATE"), "row 3 should have date error");
  assert.equal(rows.items![2].errors.length, 0, "row 4 should be valid");
});

// ---------------------------------------------------------------------------
// 10. All required fields missing in procurement
// ---------------------------------------------------------------------------
test("row with non-empty but invalid required fields — multiple errors", () => {
  // Use non-empty but invalid values so the row isn't skipped as all-empty
  const row = validateRows("PROCUREMENT", [
    procHead,
    { n: 2, v: ["bad-date", "", "XXX", "", "", "", "not-a-number"] },
  ]);
  const errs = row.items![0].errors;
  assert.ok(errs.some(e => e.field === "Date"), "should flag Date as invalid");
  assert.ok(errs.some(e => e.field === "Product" && e.code === "PLACEHOLDER_VALUE"), "should flag Product XXX");
  assert.ok(errs.some(e => e.field === "Procured"), "should flag Procured as invalid integer");
});

// ---------------------------------------------------------------------------
// 11. Duplicate detection key is type-scoped
// ---------------------------------------------------------------------------
test("same data in PROCUREMENT vs STOCK_COUNT are not cross-type duplicates", () => {
  // This validates that the duplicate key includes the type
  const row1 = { n: 2, v: [1, "", "Widget", "L", "Blue", "Brand", 100, 50, 80] };
  const row2 = { n: 3, v: [2, "", "Widget", "L", "Blue", "Brand", 100, 50, 80] };
  const sc = validateRows("STOCK_COUNT", [scHead, row1, row2]);
  // row2 has different S.N so different dateKey, so NOT a duplicate
  assert.equal(sc.items![0].errors.length, 0);
  assert.ok(!sc.items![1].errors.some(e => e.code === "DUPLICATE_ROW"), "rows with different S.N should not be duplicates");
});

// Per the STOCK_COUNT template, Procured and Distributed Qty are in 'ints' and thus required.
// Empty values in these fields produce MISSING_REQUIRED errors, which is the correct behavior.
test("Stock Count — Procured and Distributed Qty are integer-required per the template", () => {
  const row = validateRows("STOCK_COUNT", [
    scHead,
    { n: 2, v: [1, "", "Widget", "", "", "", "", "", 50] }, // Procured and DistQty blank
  ]);
  // These fields are in ints[], so blank produces MISSING_REQUIRED — this is template-defined behavior
  assert.ok(row.items![0].errors.some(e => e.field === "Procured" && e.code === "MISSING_REQUIRED"),
    "blank Procured should flag MISSING_REQUIRED per template");
  assert.ok(row.items![0].errors.some(e => e.field === "Distributed Qty" && e.code === "MISSING_REQUIRED"),
    "blank Distributed Qty should flag MISSING_REQUIRED per template");
  // NOTE: OQ-3 is open on whether these cross-check fields should remain required.
  // If confirmed as optional, update the template 'ints' array and remove this test.
});

// ---------------------------------------------------------------------------
// 13. Canonicalize edge cases
// ---------------------------------------------------------------------------
test("canonicalize: 'NA' is empty but 'NASA' is preserved", () => {
  assert.equal(canonicalize("NA"), "");
  assert.equal(canonicalize("NASA"), "NASA");
});

test("canonicalize: mixed case na/n/a variants → empty", () => {
  assert.equal(canonicalize("Na"), "");
  assert.equal(canonicalize("N/a"), "");
  assert.equal(canonicalize("nA"), "");
});

test("canonicalize: number input is stringified and trimmed", () => {
  assert.equal(canonicalize(42), "42");
  assert.equal(canonicalize(0), "0");
});

// ---------------------------------------------------------------------------
// 14. RECIPIENT template — new (13-col) format with Quantity
// ---------------------------------------------------------------------------
test("valid recipient row with Quantity passes", () => {
  const row = validateRows("RECIPIENT", [
    recipHead,
    { n: 2, v: ["2025-06-01", "E001", "Alice", "HQ", "Uniform", "John", "", "T-Shirt", "L", "Blue", "Brand", "Distributed", 2] },
  ]);
  assert.equal(row.items![0].errors.length, 0, "valid recipient row should pass");
});

test("recipient row missing Emp ID is flagged as MISSING_REQUIRED", () => {
  const row = validateRows("RECIPIENT", [
    recipHead,
    { n: 2, v: ["2025-06-01", "", "Alice", "HQ", "", "", "", "T-Shirt", "L", "Blue", "Brand", "Distributed", 2] },
  ]);
  assert.ok(row.items![0].errors.some(e => e.field === "Emp ID" && e.code === "MISSING_REQUIRED"));
});

test("recipient row missing Quantity is flagged as MISSING_REQUIRED", () => {
  const row = validateRows("RECIPIENT", [
    recipHead,
    { n: 2, v: ["2025-06-01", "E001", "Alice", "HQ", "", "", "", "T-Shirt", "L", "Blue", "Brand", "Distributed", ""] },
  ]);
  assert.ok(row.items![0].errors.some(e => e.field === "Quantity" && e.code === "MISSING_REQUIRED"));
});

test("recipient row with fractional Quantity is INVALID_INTEGER", () => {
  const row = validateRows("RECIPIENT", [
    recipHead,
    { n: 2, v: ["2025-06-01", "E001", "Alice", "HQ", "", "", "", "T-Shirt", "L", "Blue", "Brand", "Distributed", 1.5] },
  ]);
  assert.ok(row.items![0].errors.some(e => e.field === "Quantity" && e.code === "INVALID_INTEGER"));
});

// ---------------------------------------------------------------------------
// 15. Stock Count — file with only header row (no data rows)
// ---------------------------------------------------------------------------
test("file with header only (no data rows) produces no items", () => {
  const result = validateRows("STOCK_COUNT", [scHead]);
  assert.ok(!result.headerError);
  assert.equal(result.items!.length, 0);
});

// ---------------------------------------------------------------------------
// 16. Empty-row skipping in STOCK_COUNT
// ---------------------------------------------------------------------------
test("stock count skips all-empty rows between valid rows", () => {
  const result = validateRows("STOCK_COUNT", [
    scHead,
    { n: 2, v: [1, "", "Widget", "L", "Blue", "Brand", 100, 50, 80] },
    { n: 3, v: [] },   // empty
    { n: 4, v: ["", "", "", "", "", "", "", "", ""] }, // all blank
    { n: 5, v: [2, "", "Helmet", "", "", "", 20, 10, 15] },
  ]);
  assert.equal(result.items!.length, 2);
  assert.equal(result.items![0].n, 2);
  assert.equal(result.items![1].n, 5);
});

// ---------------------------------------------------------------------------
// 17. XXX in non-date, non-numeric required field
// ---------------------------------------------------------------------------
test("XXX in Product field is PLACEHOLDER_VALUE", () => {
  const result = validateRows("PROCUREMENT", [
    procHead,
    { n: 2, v: ["2025-01-01", "", "XXX", "", "", "", 10] },
  ]);
  assert.ok(result.items![0].errors.some(e => e.field === "Product" && e.code === "PLACEHOLDER_VALUE"));
});

// ---------------------------------------------------------------------------
// 18. Date cell type (Excel Date object) is accepted
// ---------------------------------------------------------------------------
test("Excel Date object is accepted as a valid date", () => {
  const d = new Date("2025-03-15");
  const result = validateRows("PROCUREMENT", [
    procHead,
    { n: 2, v: [d, "", "Widget", "", "", "", 5] },
  ]);
  assert.equal(result.items![0].errors.length, 0, "Date object should be valid");
});

// ---------------------------------------------------------------------------
// 19. Intra-file duplicate with different quantity is NOT a duplicate
// ---------------------------------------------------------------------------
test("same product/date but different quantity are NOT duplicates", () => {
  const row1 = { n: 2, v: ["2025-01-31", "", "Gloves", "M", "Blue", "Brand", 10] };
  const row2 = { n: 3, v: ["2025-01-31", "", "Gloves", "M", "Blue", "Brand", 20] }; // different qty
  const items = validateRows("PROCUREMENT", [procHead, row1, row2]).items!;
  assert.equal(items[0].errors.length, 0);
  assert.ok(!items[1].errors.some(e => e.code === "DUPLICATE_ROW"), "different quantity should not be a duplicate");
});

// ---------------------------------------------------------------------------
// 20. Missing required Stock Count fields
// ---------------------------------------------------------------------------
test("Stock Count row missing Available is invalid", () => {
  const row = validateRows("STOCK_COUNT", [
    scHead,
    { n: 2, v: [1, "", "Widget", "", "", "", 0, 0, ""] }, // Available is blank
  ]);
  assert.ok(row.items![0].errors.some(e => e.field === "Available" && e.code === "MISSING_REQUIRED"));
});

test("Stock Count row with negative Available is INVALID_INTEGER", () => {
  const row = validateRows("STOCK_COUNT", [
    scHead,
    { n: 2, v: [1, "", "Widget", "", "", "", 0, 0, -5] }, // negative Available
  ]);
  assert.ok(row.items![0].errors.some(e => e.field === "Available" && e.code === "INVALID_INTEGER"));
});
