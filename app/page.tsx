import { Dashboard } from "@/components/dashboard";
import { getMarketSnapshotAction } from "@/lib/market-data/actions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const snapshot = await getMarketSnapshotAction("intraday");
  return <Dashboard snapshot={snapshot} />;
}
