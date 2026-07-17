import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { isSessionKey } from "@/lib/market-data";
import { getMarketSnapshotAction } from "@/lib/market-data/actions";

export const dynamic = "force-dynamic";

export default async function AnalysisPage({ params }: { params: Promise<{ session: string }> }) {
  const { session } = await params;
  if (!isSessionKey(session)) notFound();
  const snapshot = await getMarketSnapshotAction(session);
  return <Dashboard snapshot={snapshot} />;
}
