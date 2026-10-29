import ExcelJS from "exceljs";

export type ParsedEventRecipient = {
  rowNumber: number;
  empId: string;
  name: string;
  recipientType: "WINNER" | "RUNNER_UP" | "PARTICIPANT" | "SPECIAL_RECOGNITION";
  itemIdentifier: string; // SKU or Name
  quantity: number;
  eventName?: string;
  baseLocation?: string;
  department?: string;
  email?: string;
  notes?: string;
};

export type EventParseResult = {
  recipients: ParsedEventRecipient[];
  errors: { row: number; error: string }[];
  duplicateEmpIds: string[];
  totalRows: number;
  detectedEventName?: string;
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

function normalizeRole(val: string): "WINNER" | "RUNNER_UP" | "PARTICIPANT" | "SPECIAL_RECOGNITION" {
  const v = val.toUpperCase().replace(/[^A-Z]/g, "");
  if (v.includes("RUNNER")) return "RUNNER_UP";
  if (v.includes("WIN")) return "WINNER";
  if (v.includes("SPECIAL") || v.includes("HONOR")) return "SPECIAL_RECOGNITION";
  return "PARTICIPANT";
}

export async function parseEventRecipientsWorkbook(buffer: Buffer): Promise<EventParseResult> {
  const workbook = new ExcelJS.Workbook();
  // @ts-expect-error ExcelJS buffer overload
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("The uploaded Excel workbook contains no worksheets.");
  }

  let detectedEventName: string | undefined;
  let fallbackSheetTitle: string | undefined;

  // Check worksheet title for fallback event name
  const sheetTitle = worksheet.name?.trim();
  if (
    sheetTitle &&
    !/^sheet\d*$/i.test(sheetTitle) &&
    !/^worksheet\d*$/i.test(sheetTitle) &&
    !/^event recipients$/i.test(sheetTitle) &&
    !/^requisition request$/i.test(sheetTitle)
  ) {
    fallbackSheetTitle = sheetTitle;
  }

  // Find header row (check row 1 through 6)
  let headerRowIndex = 1;
  for (let r = 1; r <= Math.min(6, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    const rowValues: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      const cellVal = getCellValue(cell.value);
      rowValues.push(cellVal.toLowerCase());

      // Also check if any cell above header row specifies Event name (e.g., "Event: Annual Hackathon 2026")
      if (/^event(\s*name)?\s*[:=-]\s*(.+)$/i.test(cellVal)) {
        const m = cellVal.match(/^event(\s*name)?\s*[:=-]\s*(.+)$/i);
        if (m && m[2]?.trim()) {
          detectedEventName = m[2].trim();
        }
      }
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
    } else if (val.includes("event") || val.includes("occasion")) {
      colMap.eventName = colNumber;
    } else if (val.includes("sku") || val.includes("item") || val.includes("goodie") || val.includes("product")) {
      colMap.item = colNumber;
    } else if (val.includes("name") || val.includes("employeename") || val.includes("fullname")) {
      colMap.name = colNumber;
    } else if (val.includes("role") || val.includes("recognition") || val.includes("type") || val.includes("category")) {
      colMap.role = colNumber;
    } else if (val.includes("qty") || val.includes("quantity") || val.includes("count") || val.includes("units")) {
      colMap.quantity = colNumber;
    } else if (val.includes("location") || val.includes("base") || val.includes("office") || val.includes("city")) {
      colMap.baseLocation = colNumber;
    } else if (val.includes("dept") || val.includes("department")) {
      colMap.department = colNumber;
    } else if (val.includes("email") || val.includes("mail")) {
      colMap.email = colNumber;
    } else if (val.includes("note") || val.includes("remark") || val.includes("reason")) {
      colMap.notes = colNumber;
    }
  });

  if (!colMap.empId || !colMap.name) {
    throw new Error("Spreadsheet must contain at least 'Emp ID' and 'Name' column headers.");
  }

  const recipients: ParsedEventRecipient[] = [];
  const errors: { row: number; error: string }[] = [];
  const empIdOccurrences = new Map<string, number[]>();

  for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const empId = colMap.empId ? getCellValue(row.getCell(colMap.empId).value) : "";
    const name = colMap.name ? getCellValue(row.getCell(colMap.name).value) : "";
    const roleRaw = colMap.role ? getCellValue(row.getCell(colMap.role).value) : "";
    const itemRaw = colMap.item ? getCellValue(row.getCell(colMap.item).value) : "";
    const qtyRaw = colMap.quantity ? getCellValue(row.getCell(colMap.quantity).value) : "1";
    const rowEventName = colMap.eventName ? getCellValue(row.getCell(colMap.eventName).value) : "";
    const baseLocation = colMap.baseLocation ? getCellValue(row.getCell(colMap.baseLocation).value) : "HQ";
    const department = colMap.department ? getCellValue(row.getCell(colMap.department).value) : undefined;
    const email = colMap.email ? getCellValue(row.getCell(colMap.email).value) : undefined;
    const notes = colMap.notes ? getCellValue(row.getCell(colMap.notes).value) : undefined;

    // Skip blank rows
    if (!empId && !name && !itemRaw) continue;

    if (!empId) {
      errors.push({ row: r, error: `Row ${r}: Missing Employee ID (Emp ID is required)` });
      continue;
    }
    if (!name) {
      errors.push({ row: r, error: `Row ${r}: Missing Employee Name (Name is required)` });
      continue;
    }

    if (rowEventName && !detectedEventName) {
      detectedEventName = rowEventName;
    }

    const cleanEmpId = empId.toUpperCase().trim();
    const rowsForEmp = empIdOccurrences.get(cleanEmpId) || [];
    rowsForEmp.push(r);
    empIdOccurrences.set(cleanEmpId, rowsForEmp);

    let quantity = parseInt(qtyRaw, 10);
    if (isNaN(quantity) || quantity <= 0) {
      quantity = 1;
    }

    recipients.push({
      rowNumber: r,
      empId: cleanEmpId,
      name: name.trim(),
      recipientType: normalizeRole(roleRaw),
      itemIdentifier: itemRaw.trim(),
      quantity,
      eventName: rowEventName?.trim() || detectedEventName || fallbackSheetTitle || undefined,
      baseLocation: baseLocation.trim() || "HQ",
      department: department?.trim() || undefined,
      email: email?.trim() || undefined,
      notes: notes?.trim() || undefined,
    });
  }

  const duplicateEmpIds: string[] = [];
  empIdOccurrences.forEach((rows, id) => {
    if (rows.length > 1) {
      duplicateEmpIds.push(id);
    }
  });

  return {
    recipients,
    errors,
    duplicateEmpIds,
    totalRows: recipients.length + errors.length,
    detectedEventName: (detectedEventName || fallbackSheetTitle)?.trim() || undefined,
  };
}

export async function generateEventRecipientsTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Mavericks Inventory";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Event Recipients", {
    views: [{ showGridLines: true }],
  });

  sheet.columns = [
    { header: "Emp ID", key: "empId", width: 16 },
    { header: "Name", key: "name", width: 26 },
    { header: "Role", key: "role", width: 18 },
    { header: "Item SKU or Name", key: "item", width: 28 },
    { header: "Quantity", key: "quantity", width: 12 },
    { header: "Base Location", key: "baseLocation", width: 18 },
    { header: "Department", key: "department", width: 20 },
    { header: "Email", key: "email", width: 26 },
    { header: "Notes", key: "notes", width: 30 },
  ];

  // Header style
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" }, // Mavericks Blue
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 28;

  // Sample data rows
  const sampleRows = [
    {
      empId: "EMP-001",
      name: "Karthick Raja",
      role: "Winner",
      item: "TSHIRT-L-ASH",
      quantity: 1,
      baseLocation: "Chennai",
      department: "Engineering",
      email: "karthick@mavericks.test",
      notes: "Hackathon 1st Place",
    },
    {
      empId: "EMP-002",
      name: "Sarah Jenkins",
      role: "Runner-up",
      item: "HOODIE-M-BLK",
      quantity: 1,
      baseLocation: "Bangalore",
      department: "Design",
      email: "sarah@mavericks.test",
      notes: "Hackathon 2nd Place",
    },
    {
      empId: "EMP-003",
      name: "David Chen",
      role: "Participant",
      item: "CAP-BLUE",
      quantity: 1,
      baseLocation: "HQ",
      department: "Operations",
      email: "david@mavericks.test",
      notes: "Participant Swag",
    },
  ];

  sampleRows.forEach((data) => {
    const row = sheet.addRow(data);
    row.height = 22;
    row.alignment = { vertical: "middle" };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generateRequestRecipientsTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Mavericks Inventory";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Requisition Request", {
    views: [{ showGridLines: true }],
  });

  sheet.columns = [
    { header: "Event Name", key: "eventName", width: 26 },
    { header: "Emp ID", key: "empId", width: 16 },
    { header: "Name", key: "name", width: 26 },
    { header: "Role", key: "role", width: 18 },
    { header: "Item SKU or Name", key: "item", width: 28 },
    { header: "Quantity", key: "quantity", width: 12 },
    { header: "Base Location", key: "baseLocation", width: 18 },
    { header: "Department", key: "department", width: 20 },
    { header: "Email", key: "email", width: 26 },
    { header: "Notes", key: "notes", width: 30 },
  ];

  // Header style
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" }, // Mavericks Blue
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 28;

  // Sample data rows
  const sampleRows = [
    {
      eventName: "Annual Hackathon 2026",
      empId: "EMP-001",
      name: "Karthick Raja",
      role: "Winner",
      item: "TSHIRT-L-ASH",
      quantity: 1,
      baseLocation: "Chennai",
      department: "Engineering",
      email: "karthick@mavericks.test",
      notes: "1st Place Winner Goodie",
    },
    {
      eventName: "Annual Hackathon 2026",
      empId: "EMP-002",
      name: "Sarah Jenkins",
      role: "Runner-up",
      item: "HOODIE-M-BLK",
      quantity: 1,
      baseLocation: "Bangalore",
      department: "Design",
      email: "sarah@mavericks.test",
      notes: "2nd Place Runner-up",
    },
    {
      eventName: "Annual Hackathon 2026",
      empId: "EMP-003",
      name: "David Chen",
      role: "Participant",
      item: "CAP-BLUE",
      quantity: 1,
      baseLocation: "HQ",
      department: "Operations",
      email: "david@mavericks.test",
      notes: "Participant Swag",
    },
  ];

  sampleRows.forEach((data) => {
    const row = sheet.addRow(data);
    row.height = 22;
    row.alignment = { vertical: "middle" };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
