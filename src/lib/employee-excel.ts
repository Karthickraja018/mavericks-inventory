import ExcelJS from "exceljs";

export type ParsedEmployee = {
  empId: string;
  name: string;
  baseLocation: string;
  department?: string;
  email?: string;
  rowNumber: number;
};

export type EmployeeParseResult = {
  employees: ParsedEmployee[];
  errors: { row: number; error: string }[];
  totalRows: number;
};

function getCellValue(val: any): string {
  if (val == null) return "";
  if (typeof val === "object") {
    if ("result" in val && val.result != null) return String(val.result).trim();
    if ("richText" in val && Array.isArray(val.richText)) {
      return val.richText.map((t: any) => t.text || "").join("").trim();
    }
    if ("text" in val && val.text != null) return String(val.text).trim();
  }
  return String(val).trim();
}

export async function parseEmployeeWorkbook(buffer: Buffer): Promise<EmployeeParseResult> {
  const workbook = new ExcelJS.Workbook();
  // @ts-expect-error ExcelJS buffer overload
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("The uploaded Excel workbook contains no worksheets.");
  }

  // Find header row (check row 1 or row 2)
  let headerRowIndex = 1;
  let headers: string[] = [];
  for (let r = 1; r <= Math.min(5, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    const rowValues: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      rowValues.push(getCellValue(cell.value).toLowerCase());
    });
    const hasEmpId = rowValues.some((v) => v.includes("emp") || v.includes("id"));
    const hasName = rowValues.some((v) => v.includes("name"));
    if (hasEmpId && hasName) {
      headerRowIndex = r;
      break;
    }
  }

  const headerRow = worksheet.getRow(headerRowIndex);
  const colMap: Record<string, number> = {};

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const val = getCellValue(cell.value).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (val.includes("empid") || val === "id" || val.includes("employeeid") || val.includes("empno")) {
      colMap.empId = colNumber;
    } else if (val.includes("name") || val.includes("employeename") || val.includes("fullname")) {
      colMap.name = colNumber;
    } else if (val.includes("location") || val.includes("base") || val.includes("office") || val.includes("city")) {
      colMap.baseLocation = colNumber;
    } else if (val.includes("dept") || val.includes("department")) {
      colMap.department = colNumber;
    } else if (val.includes("email") || val.includes("mail")) {
      colMap.email = colNumber;
    }
  });

  if (!colMap.empId || !colMap.name) {
    throw new Error("Excel file must contain at least 'Emp ID' and 'Name' column headers.");
  }

  const employees: ParsedEmployee[] = [];
  const errors: { row: number; error: string }[] = [];
  const seenEmpIds = new Set<string>();

  for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const empId = colMap.empId ? getCellValue(row.getCell(colMap.empId).value) : "";
    const name = colMap.name ? getCellValue(row.getCell(colMap.name).value) : "";
    const baseLocation = colMap.baseLocation ? getCellValue(row.getCell(colMap.baseLocation).value) : "HQ";
    const department = colMap.department ? getCellValue(row.getCell(colMap.department).value) : undefined;
    const email = colMap.email ? getCellValue(row.getCell(colMap.email).value) : undefined;

    // Skip empty rows
    if (!empId && !name) continue;

    if (!empId) {
      errors.push({ row: r, error: `Row ${r}: Missing Employee ID (Emp ID is required)` });
      continue;
    }
    if (!name) {
      errors.push({ row: r, error: `Row ${r}: Missing Employee Name (Name is required)` });
      continue;
    }

    const cleanEmpId = empId.toUpperCase();
    if (seenEmpIds.has(cleanEmpId)) {
      errors.push({ row: r, error: `Row ${r}: Duplicate Employee ID '${cleanEmpId}' within sheet (will update existing)` });
    }
    seenEmpIds.add(cleanEmpId);

    employees.push({
      empId: cleanEmpId,
      name,
      baseLocation: baseLocation || "HQ",
      department: department || undefined,
      email: email || undefined,
      rowNumber: r,
    });
  }

  return {
    employees,
    errors,
    totalRows: employees.length + errors.length,
  };
}

export async function generateEmployeeTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Mavericks Inventory";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Employees", {
    views: [{ showGridLines: true }],
  });

  sheet.columns = [
    { header: "Emp ID", key: "empId", width: 16 },
    { header: "Name", key: "name", width: 28 },
    { header: "Base Location", key: "baseLocation", width: 20 },
    { header: "Department", key: "department", width: 22 },
    { header: "Email", key: "email", width: 28 },
  ];

  // Header style
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF334E80" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 28;

  // Sample data rows
  const sampleRows = [
    { empId: "EMP-001", name: "Karthick Raja", baseLocation: "Chennai", department: "Engineering", email: "karthick@mavericks.test" },
    { empId: "EMP-002", name: "Sarah Jenkins", baseLocation: "Bangalore", department: "Design", email: "sarah@mavericks.test" },
    { empId: "EMP-003", name: "David Chen", baseLocation: "HQ", department: "Operations", email: "david@mavericks.test" },
    { empId: "EMP-004", name: "Priya Sharma", baseLocation: "Hyderabad", department: "Marketing", email: "priya@mavericks.test" },
  ];

  sampleRows.forEach((data) => {
    const row = sheet.addRow(data);
    row.height = 22;
    row.alignment = { vertical: "middle" };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
