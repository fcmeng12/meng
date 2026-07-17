import { NextResponse } from "next/server";
import { getMarketStatus } from "@/lib/market-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getMarketStatus();
  return NextResponse.json(status, {
    status: status.connected ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
