import { NextRequest, NextResponse } from "next/server";
import { getMarketSnapshot, isSessionKey } from "@/lib/market-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("session") ?? "intraday";
  const session = isSessionKey(requested) ? requested : "intraday";
  const snapshot = await getMarketSnapshot(session);

  return NextResponse.json(snapshot, {
    status: snapshot.available ? 200 : 503,
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
