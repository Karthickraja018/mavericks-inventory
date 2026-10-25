import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { readFirstSheet, validateRows } from "./imports";

const fixturesDir = path.resolve(process.cwd(), "fixtures/workbooks");

test("Stock Count valid workbook parses and validates with 0 errors", async () => {
  const buf = fs.readFileSync(path.join(fixturesDir, "Stock_Count_Sample_Valid.xlsx"));
  const rawRows = await readFirstSheet(buf);
  const result = validateRows("STOCK_COUNT", rawRows);
  assert.ok(!result.headerError, "Should have no header error");
  assert.ok(result.items && result.items.length === 11, "Should have 11 items");
  const totalErrors = result.items.reduce((acc, row) => acc + row.errors.length, 0);
  assert.equal(totalErrors, 0, "Should have zero row validation errors");
});

test("Stock Count invalid workbook flags expected errors", async () => {
  const buf = fs.readFileSync(path.join(fixturesDir, "Stock_Count_Sample_Invalid.xlsx"));
  const rawRows = await readFirstSheet(buf);
  const result = validateRows("STOCK_COUNT", rawRows);
  assert.ok(!result.headerError);
  assert.ok(result.items && result.items.length > 0);
  const allCodes = result.items.flatMap((r) => r.errors.map((e) => e.code));
  assert.ok(allCodes.includes("MISSING_REQUIRED"), "Should flag missing Available");
  assert.ok(allCodes.includes("INVALID_INTEGER"), "Should flag negative or decimal integer");
  assert.ok(allCodes.includes("PLACEHOLDER_VALUE"), "Should flag placeholder XXX");
  assert.ok(allCodes.includes("DUPLICATE_ROW"), "Should flag duplicate row");
});

test("Procurement valid workbook parses and validates with 0 errors", async () => {
  const buf = fs.readFileSync(path.join(fixturesDir, "Procurement_Sample_Valid.xlsx"));
  const rawRows = await readFirstSheet(buf);
  const result = validateRows("PROCUREMENT", rawRows);
  assert.ok(!result.headerError, "Should have no header error");
  assert.ok(result.items && result.items.length === 6, "Should have 6 items");
  const totalErrors = result.items.reduce((acc, row) => acc + row.errors.length, 0);
  assert.equal(totalErrors, 0, "Should have zero row validation errors");
});

test("Procurement invalid workbook flags expected errors", async () => {
  const buf = fs.readFileSync(path.join(fixturesDir, "Procurement_Sample_Invalid.xlsx"));
  const rawRows = await readFirstSheet(buf);
  const result = validateRows("PROCUREMENT", rawRows);
  assert.ok(!result.headerError);
  const allCodes = result.items!.flatMap((r) => r.errors.map((e) => e.code));
  assert.ok(allCodes.includes("PLACEHOLDER_VALUE"), "Should flag XXX in date");
  assert.ok(allCodes.includes("INVALID_INTEGER"), "Should flag negative or non-numeric quantity");
  assert.ok(allCodes.includes("MISSING_REQUIRED"), "Should flag missing required Product");
  assert.ok(allCodes.includes("DUPLICATE_ROW"), "Should flag duplicate row");
});

test("Recipient supplied 12-column template parses with MISSING_QUANTITY_COLUMN warning", async () => {
  const buf = fs.readFileSync(path.join(fixturesDir, "Recipient_Sample_Valid.xlsx"));
  const rawRows = await readFirstSheet(buf);
  const result = validateRows("RECIPIENT", rawRows);
  assert.ok(!result.headerError, "12-column supplied template should pass header validation");
  assert.ok(result.items && result.items.length === 6);
  // All rows in 12-col template should specifically flag MISSING_QUANTITY_COLUMN
  const codes = result.items[0].errors.map((e) => e.code);
  assert.ok(codes.includes("MISSING_QUANTITY_COLUMN"), "Should note missing quantity column");
});

test("Recipient 13-column template with Quantity parses with 0 errors", async () => {
  const buf = fs.readFileSync(path.join(fixturesDir, "Recipient_Sample_With_Quantity.xlsx"));
  const rawRows = await readFirstSheet(buf);
  const result = validateRows("RECIPIENT", rawRows);
  assert.ok(!result.headerError, "13-column template should pass header validation");
  assert.ok(result.items && result.items.length === 6);
  const totalErrors = result.items.reduce((acc, row) => acc + row.errors.length, 0);
  assert.equal(totalErrors, 0, "Should have zero row validation errors");
});

test("Recipient invalid workbook flags expected errors", async () => {
  const buf = fs.readFileSync(path.join(fixturesDir, "Recipient_Sample_Invalid.xlsx"));
  const rawRows = await readFirstSheet(buf);
  const result = validateRows("RECIPIENT", rawRows);
  assert.ok(!result.headerError);
  const allCodes = result.items!.flatMap((r) => r.errors.map((e) => e.code));
  assert.ok(allCodes.includes("MISSING_REQUIRED"), "Should flag missing Emp ID");
  assert.ok(allCodes.includes("INVALID_INTEGER"), "Should flag negative quantity");
  assert.ok(allCodes.includes("PLACEHOLDER_VALUE"), "Should flag XXX placeholder");
});
