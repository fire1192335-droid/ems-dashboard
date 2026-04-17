import { NextResponse } from "next/server";

import { getGoogleSheetValues } from "@/lib/googleSheets";
import { parseSupplies } from "@/lib/parseSupplies";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await getGoogleSheetValues();
    const payload = parseSupplies(rows);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "讀取 Google Sheets 失敗，請確認 .env.local 與 Service Account 權限設定。",
        details: message,
      },
      {
        status: 500,
      },
    );
  }
}
