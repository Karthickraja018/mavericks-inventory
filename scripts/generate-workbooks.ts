import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

// Column headers as defined in BRD and confirmed business requirements
const STOCK_COUNT_COLS = [
  "S.N",
  "Product Details",
  "Product",
  "Size / Quantity",
  "Color",
  "Brand",
  "Procured",
  "Distributed Qty",
  "Available",
];

const PROCUREMENT_COLS = [
  "Date",
  "Product Details",
  "Product",
  "Size / Quantity",
  "Color",
  "Brand",
  "Procured",
];

// Official 12-column Recipient template (from supplied screenshots)
const RECIPIENT_SUPPLIED_COLS = [
  "Date",
  "Emp ID",
  "Name",
  "Base Location",
  "Category",
  "POC",
  "Product Details",
  "Product",
  "Size / Quantity",
  "Color",
  "Brand",
  "Status",
];

// Updated 13-column Recipient template (with Quantity)
const RECIPIENT_UPDATED_COLS = [
  ...RECIPIENT_SUPPLIED_COLS,
  "Quantity",
];

async function saveWorkbook(wb: ExcelJS.Workbook, filename: string, targetDirs: string[]) {
  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const fullPath = path.join(dir, filename);
    await wb.xlsx.writeFile(fullPath);
    console.log(`Saved: ${fullPath}`);
  }
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" }, // dark slate
  };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.height = 24;
}

// -----------------------------------------------------------------------------
// 1. Stock Count - Valid Sample Workbook
// -----------------------------------------------------------------------------
export async function createStockCountValid(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Mavericks Inventory";
  const ws = wb.addWorksheet("Stock Count");

  ws.columns = STOCK_COUNT_COLS.map((header) => ({
    header,
    key: header,
    width: header.length < 12 ? 14 : header.length + 4,
  }));
  styleHeaderRow(ws.getRow(1));

  const sampleRows = [
    [1, "Mavericks T-Shirt - Ash (S)", "Mavericks T-Shirt", "S", "Ash", "Crocodile", 100, 15, 85],
    [2, "Mavericks T-Shirt - Ash (M)", "Mavericks T-Shirt", "M", "Ash", "Crocodile", 170, 30, 140],
    [3, "Mavericks T-Shirt - Ash (L)", "Mavericks T-Shirt", "L", "Ash", "Crocodile", 120, 10, 110],
    [4, "Mavericks T-Shirt - Ash (XL)", "Mavericks T-Shirt", "XL", "Ash", "Crocodile", 20, 14, 6],
    [5, "Mavericks T-Shirt - Ash (XXL)", "Mavericks T-Shirt", "XXL", "Ash", "Crocodile", 15, 12, 3],
    [6, "Mavericks T-Shirt - Ash (XXXL)", "Mavericks T-Shirt", "XXXL", "Ash", "Crocodile", 0, 0, 0],
    [7, "Bot All Coffee Mug - Blue", "Bot All Coffee Mug", "NA", "Blue", "NA", 90, 15, 75],
    [8, "Bot All Coffee Mug - Black", "Bot All Coffee Mug", "NA", "Black", "NA", 15, 10, 5],
    [9, "Headphones (RGB) - Black (Large)", "Headphones (RGB)", "Large", "Black", "Boat", 40, 5, 35],
    [10, "Wireless Mouse - Black", "Wireless Mouse", "NA", "Black", "NA", 25, 21, 4],
    [11, "Laptop Sticker Pack", "Laptop Sticker", "NA", "NA", "NA", 350, 30, 320],
  ];

  sampleRows.forEach((r) => ws.addRow(r));
  return wb;
}

// -----------------------------------------------------------------------------
// 2. Stock Count - Invalid Test Workbook
// -----------------------------------------------------------------------------
export async function createStockCountInvalid(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Stock Count");

  ws.columns = STOCK_COUNT_COLS.map((header) => ({ header, key: header, width: 16 }));
  styleHeaderRow(ws.getRow(1));

  const invalidRows = [
    // Row 2: Missing Available (required field for reconciliation)
    [1, "Mavericks T-Shirt - Ash (S)", "Mavericks T-Shirt", "S", "Ash", "Crocodile", 100, 15, ""],
    // Row 3: Negative Available (violates non-negative integer rule)
    [2, "Mavericks T-Shirt - Ash (M)", "Mavericks T-Shirt", "M", "Ash", "Crocodile", 170, 30, -5],
    // Row 4: Placeholder 'XXX' in Product
    [3, "Placeholder item", "XXX", "NA", "Blue", "NA", 90, 15, 75],
    // Row 5: Decimal quantity
    [4, "Wireless Mouse", "Wireless Mouse", "NA", "Black", "NA", 25, 21, 4.5],
    // Row 6: Valid row
    [5, "Bot All Coffee Mug - Blue", "Bot All Coffee Mug", "NA", "Blue", "NA", 90, 15, 75],
    // Row 7: Intra-file duplicate of Row 6 (same S.N, product, size, color, brand, available)
    [5, "Bot All Coffee Mug - Blue", "Bot All Coffee Mug", "NA", "Blue", "NA", 90, 15, 75],
  ];

  invalidRows.forEach((r) => ws.addRow(r));
  return wb;
}

// -----------------------------------------------------------------------------
// 3. Procurement - Valid Sample Workbook
// -----------------------------------------------------------------------------
export async function createProcurementValid(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Procurement");

  ws.columns = PROCUREMENT_COLS.map((header) => ({
    header,
    key: header,
    width: header === "Date" ? 14 : header.length + 4,
  }));
  styleHeaderRow(ws.getRow(1));

  const sampleRows = [
    ["2026-02-10", "Mavericks T-Shirt - Ash (M) Batch 1", "Mavericks T-Shirt", "M", "Ash", "Crocodile", 50],
    ["2026-02-15", "Mavericks T-Shirt - Ash (L) Batch 1", "Mavericks T-Shirt", "L", "Ash", "Crocodile", 40],
    ["2026-03-01", "Bot All Coffee Mug - Blue Restock", "Bot All Coffee Mug", "NA", "Blue", "NA", 30],
    ["2026-03-12", "Headphones (RGB) Audio Gear", "Headphones (RGB)", "Large", "Black", "Boat", 25],
    ["2026-03-25", "Wireless Mouse Procurement", "Wireless Mouse", "NA", "Black", "NA", 20],
    ["2026-04-05", "Laptop Stickers Custom Die-cut", "Laptop Sticker", "NA", "NA", "NA", 150],
  ];

  sampleRows.forEach((r) => ws.addRow(r));
  return wb;
}

// -----------------------------------------------------------------------------
// 4. Procurement - Invalid Test Workbook
// -----------------------------------------------------------------------------
export async function createProcurementInvalid(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Procurement");

  ws.columns = PROCUREMENT_COLS.map((header) => ({ header, key: header, width: 16 }));
  styleHeaderRow(ws.getRow(1));

  const invalidRows = [
    // Row 2: Placeholder 'XXX' in date
    ["XXX", "Mavericks T-Shirt - Ash (M)", "Mavericks T-Shirt", "M", "Ash", "Crocodile", 50],
    // Row 3: Negative Procured quantity
    ["2026-02-15", "Mavericks T-Shirt - Ash (L)", "Mavericks T-Shirt", "L", "Ash", "Crocodile", -10],
    // Row 4: Missing required Product field
    ["2026-03-01", "Unlabeled item", "", "NA", "Blue", "NA", 30],
    // Row 5: Non-numeric quantity
    ["2026-03-12", "Headphones", "Headphones (RGB)", "Large", "Black", "Boat", "twenty"],
    // Row 6: Valid row
    ["2026-03-20", "Wireless Mouse Batch", "Wireless Mouse", "NA", "Black", "NA", 15],
    // Row 7: Duplicate of row 6 (triggers DUPLICATE_ROW)
    ["2026-03-20", "Wireless Mouse Batch", "Wireless Mouse", "NA", "Black", "NA", 15],
  ];

  invalidRows.forEach((r) => ws.addRow(r));
  return wb;
}

// -----------------------------------------------------------------------------
// 5. Recipient - Valid Supplied Workbook (12 Columns, No Quantity)
// Note: Matches screenshot template exactly.
// -----------------------------------------------------------------------------
export async function createRecipientValidSupplied(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Recipient");

  ws.columns = RECIPIENT_SUPPLIED_COLS.map((header) => ({
    header,
    key: header,
    width: header === "Date" ? 14 : header.length + 4,
  }));
  styleHeaderRow(ws.getRow(1));

  const sampleRows = [
    ["2026-02-15", "EMP-1001", "Priya Sharma", "Bengaluru", "Onboarding", "Vikram Malhotra", "Mavericks T-Shirt (S)", "Mavericks T-Shirt", "S", "Ash", "Crocodile", "Distributed"],
    ["2026-02-15", "EMP-1001", "Priya Sharma", "Bengaluru", "Onboarding", "Vikram Malhotra", "Bot All Coffee Mug", "Bot All Coffee Mug", "NA", "Blue", "NA", "Distributed"],
    ["2026-02-16", "EMP-1002", "Rohan Desai", "Pune", "Internship", "HR Operations", "Mavericks T-Shirt (M)", "Mavericks T-Shirt", "M", "Ash", "Crocodile", "Distributed"],
    ["2026-02-16", "EMP-1003", "Ananya Iyer", "Chennai", "Event Participation", "Campus Team", "Headphones (RGB)", "Headphones (RGB)", "Large", "Black", "Boat", "Distributed"],
    ["2026-02-17", "EMP-1004", "Vikram Malhotra", "Bengaluru", "Event Design", "Admin Desk", "Wireless Mouse", "Wireless Mouse", "NA", "Black", "NA", "Distributed"],
    ["2026-02-18", "EMP-1005", "Sneha Patel", "Pune", "Onboarding", "Priya Sharma", "Laptop Sticker", "Laptop Sticker", "NA", "NA", "NA", "Distributed"],
  ];

  sampleRows.forEach((r) => ws.addRow(r));
  return wb;
}

// -----------------------------------------------------------------------------
// 6. Recipient - Valid Workbook With Quantity (13 Columns)
// -----------------------------------------------------------------------------
export async function createRecipientValidWithQuantity(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Recipient");

  ws.columns = RECIPIENT_UPDATED_COLS.map((header) => ({
    header,
    key: header,
    width: header === "Date" ? 14 : header.length + 4,
  }));
  styleHeaderRow(ws.getRow(1));

  const sampleRows = [
    ["2026-02-15", "EMP-1001", "Priya Sharma", "Bengaluru", "Onboarding", "Vikram Malhotra", "Mavericks T-Shirt (S)", "Mavericks T-Shirt", "S", "Ash", "Crocodile", "Distributed", 1],
    ["2026-02-15", "EMP-1001", "Priya Sharma", "Bengaluru", "Onboarding", "Vikram Malhotra", "Bot All Coffee Mug", "Bot All Coffee Mug", "NA", "Blue", "NA", "Distributed", 1],
    ["2026-02-16", "EMP-1002", "Rohan Desai", "Pune", "Internship", "HR Operations", "Mavericks T-Shirt (M)", "Mavericks T-Shirt", "M", "Ash", "Crocodile", "Distributed", 2],
    ["2026-02-16", "EMP-1003", "Ananya Iyer", "Chennai", "Event Participation", "Campus Team", "Headphones (RGB)", "Headphones (RGB)", "Large", "Black", "Boat", "Distributed", 1],
    ["2026-02-17", "EMP-1004", "Vikram Malhotra", "Bengaluru", "Event Design", "Admin Desk", "Wireless Mouse", "Wireless Mouse", "NA", "Black", "NA", "Distributed", 1],
    ["2026-02-18", "EMP-1005", "Sneha Patel", "Pune", "Onboarding", "Priya Sharma", "Laptop Sticker", "Laptop Sticker", "NA", "NA", "NA", "Distributed", 5],
  ];

  sampleRows.forEach((r) => ws.addRow(r));
  return wb;
}

// -----------------------------------------------------------------------------
// 7. Recipient - Invalid Test Workbook
// -----------------------------------------------------------------------------
export async function createRecipientInvalid(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Recipient");

  ws.columns = RECIPIENT_UPDATED_COLS.map((header) => ({ header, key: header, width: 16 }));
  styleHeaderRow(ws.getRow(1));

  const invalidRows = [
    // Row 2: Missing Emp ID
    ["2026-02-15", "", "Priya Sharma", "Bengaluru", "Onboarding", "Vikram Malhotra", "Mavericks T-Shirt", "Mavericks T-Shirt", "S", "Ash", "Crocodile", "Distributed", 1],
    // Row 3: Name mismatch (Priya vs Wrong Name)
    ["2026-02-15", "EMP-1001", "Wrong Name", "Bengaluru", "Onboarding", "Vikram Malhotra", "Mug", "Bot All Coffee Mug", "NA", "Blue", "NA", "Distributed", 1],
    // Row 4: Base Location mismatch (Pune vs Kolkata)
    ["2026-02-16", "EMP-1002", "Rohan Desai", "Kolkata", "Internship", "HR Operations", "T-Shirt", "Mavericks T-Shirt", "M", "Ash", "Crocodile", "Distributed", 1],
    // Row 5: Negative quantity
    ["2026-02-16", "EMP-1003", "Ananya Iyer", "Chennai", "Event Participation", "Campus Team", "Headphones", "Headphones (RGB)", "Large", "Black", "Boat", "Distributed", -2],
    // Row 6: Placeholder 'XXX'
    ["XXX", "EMP-1004", "Vikram Malhotra", "Bengaluru", "Event Design", "Admin Desk", "Mouse", "Wireless Mouse", "NA", "Black", "NA", "Distributed", 1],
  ];

  invalidRows.forEach((r) => ws.addRow(r));
  return wb;
}

// -----------------------------------------------------------------------------
// Main execution
// -----------------------------------------------------------------------------
async function main() {
  const publicDir = path.resolve(process.cwd(), "public/templates");
  const fixturesDir = path.resolve(process.cwd(), "fixtures/workbooks");
  const targetDirs = [publicDir, fixturesDir];

  console.log("Generating synthetic Excel workbooks...");

  await saveWorkbook(await createStockCountValid(), "Stock_Count_Sample_Valid.xlsx", targetDirs);
  await saveWorkbook(await createStockCountInvalid(), "Stock_Count_Sample_Invalid.xlsx", targetDirs);
  await saveWorkbook(await createProcurementValid(), "Procurement_Sample_Valid.xlsx", targetDirs);
  await saveWorkbook(await createProcurementInvalid(), "Procurement_Sample_Invalid.xlsx", targetDirs);
  await saveWorkbook(await createRecipientValidSupplied(), "Recipient_Sample_Valid.xlsx", targetDirs);
  await saveWorkbook(await createRecipientValidWithQuantity(), "Recipient_Sample_With_Quantity.xlsx", targetDirs);
  await saveWorkbook(await createRecipientInvalid(), "Recipient_Sample_Invalid.xlsx", targetDirs);

  console.log("All synthetic workbooks generated successfully.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Error generating workbooks:", err);
    process.exit(1);
  });
}
