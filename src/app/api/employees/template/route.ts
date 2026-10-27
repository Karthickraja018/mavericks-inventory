import { NextResponse } from "next/server";
import { generateEmployeeTemplate } from "@/lib/employee-excel";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const buffer = await generateEmployeeTemplate();
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="mavericks-employees-template.xlsx"',
      },
    });
  } catch (error: any) {
    return new NextResponse(error.message || "Unauthorized", { status: 401 });
  }
}
