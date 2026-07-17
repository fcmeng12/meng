"use server";

import { getMarketSnapshot } from "./service";
import type { SessionKey } from "./types";

export async function getMarketSnapshotAction(session: SessionKey) {
  return getMarketSnapshot(session);
}
