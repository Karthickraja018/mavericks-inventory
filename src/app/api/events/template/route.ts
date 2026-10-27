import { NextResponse } from "next/server";
import { generateEventRecipientsTemplate } from "@/lib/event-excel";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const buffer = await generateEventRecipientsTemplate();
    const bytes = new Uint8Array(buffer);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="mavericks-event-recipients-template.xlsx"',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to generate template" }, { status: 500 });
  }
}
