import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  parseEventRecipientsWorkbook,
  generateEventRecipientsTemplate,
} from "./event-excel";

test("generateEventRecipientsTemplate produces valid workbook with headers and sample data", async () => {
  const buffer = await generateEventRecipientsTemplate();
  assert.ok(buffer.length > 0, "Buffer should not be empty");

  const parseResult = await parseEventRecipientsWorkbook(buffer);
  assert.equal(parseResult.errors.length, 0, "Generated template should have 0 errors");
  assert.equal(parseResult.recipients.length, 3, "Generated template should have 3 sample rows");

  const winner = parseResult.recipients[0];
  assert.equal(winner.empId, "EMP-001");
  assert.equal(winner.name, "Karthick Raja");
  assert.equal(winner.recipientType, "WINNER");
  assert.equal(winner.itemIdentifier, "TSHIRT-L-ASH");
  assert.equal(winner.quantity, 1);
});

test("parseEventRecipientsWorkbook flags missing Emp ID and missing Name", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Recipients");
  sheet.addRow(["Emp ID", "Name", "Role", "Item SKU or Name", "Quantity"]);
  sheet.addRow(["", "John Doe", "Winner", "TSHIRT-L", "1"]); // missing Emp ID
  sheet.addRow(["EMP-002", "", "Participant", "CAP-BLUE", "1"]); // missing Name
  sheet.addRow(["EMP-003", "Valid Staff", "Runner-Up", "HOODIE-M", "2"]); // valid row

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const result = await parseEventRecipientsWorkbook(buffer);

  assert.equal(result.errors.length, 2, "Should record 2 row-level validation errors");
  assert.ok(result.errors[0].error.includes("Missing Employee ID"));
  assert.ok(result.errors[1].error.includes("Missing Employee Name"));
  assert.equal(result.recipients.length, 1, "Should have 1 valid recipient");
  assert.equal(result.recipients[0].empId, "EMP-003");
  assert.equal(result.recipients[0].recipientType, "RUNNER_UP");
  assert.equal(result.recipients[0].quantity, 2);
});

test("parseEventRecipientsWorkbook detects duplicate employee IDs within sheet", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Recipients");
  sheet.addRow(["Emp ID", "Name", "Role", "Item SKU or Name", "Quantity"]);
  sheet.addRow(["EMP-100", "Alice", "Winner", "ITEM-1", "1"]);
  sheet.addRow(["EMP-100", "Alice", "Participant", "ITEM-2", "1"]); // duplicate empId receiving 2nd item
  sheet.addRow(["EMP-200", "Bob", "Participant", "ITEM-1", "1"]);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const result = await parseEventRecipientsWorkbook(buffer);

  assert.equal(result.recipients.length, 3, "All 3 rows parsed");
  assert.equal(result.duplicateEmpIds.length, 1, "Should detect EMP-100 as duplicate");
  assert.equal(result.duplicateEmpIds[0], "EMP-100");
});
