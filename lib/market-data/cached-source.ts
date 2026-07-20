import { unstable_cache } from "next/cache";
import {
  queryTencentIndex,
  queryTencentStock,
  queryTencentStockLatest,
  type TencentSeriesResult,
} from "./tencent-index";
import { queryTushare } from "./tushare-client";
import type { TushareDailyRow, TushareStockBasicRow } from "./types";

const DAILY_FIELDS = [
  "ts_code", "trade_date", "open", "high", "low", "close",
  "pre_close", "pct_chg", "vol", "amount",
];

const STOCK_BASIC_FIELDS = ["ts_code", "symbol", "name", "industry", "market", "exchange"];

export interface CachedPayload<T> {
  rows: T[];
  fetchedAt: string;
}

export interface CachedTencentSeries extends TencentSeriesResult {
  fetchedAt: string;
}

async function withFetchTime<T>(request: Promise<T[]>): Promise<CachedPayload<T>> {
  const rows = await request;
  return { rows, fetchedAt: new Date().toISOString() };
}

export const getCachedIndexDaily = unstable_cache(
  async (tsCode: string, startDate: string, endDate: string) => withFetchTime(queryTushare<TushareDailyRow>(
    "index_daily",
    { ts_code: tsCode, start_date: startDate, end_date: endDate },
    DAILY_FIELDS,
  )),
  ["tushare-index-daily-v2"],
  { revalidate: 180 },
);

export const getCachedTencentIndexDaily = unstable_cache(
  async (tsCode: string): Promise<CachedTencentSeries> => ({
    ...await queryTencentIndex(tsCode),
    fetchedAt: new Date().toISOString(),
  }),
  ["tencent-index-daily-v2"],
  { revalidate: 180 },
);

export const getCachedTencentStockDaily = unstable_cache(
  async (tsCode: string): Promise<CachedTencentSeries> => ({
    ...await queryTencentStock(tsCode),
    fetchedAt: new Date().toISOString(),
  }),
  ["tencent-stock-history-v2"],
  { revalidate: 1800 },
);

export const getCachedTencentStockLatest = unstable_cache(
  async (tsCode: string): Promise<CachedTencentSeries> => ({
    ...await queryTencentStockLatest(tsCode),
    fetchedAt: new Date().toISOString(),
  }),
  ["tencent-stock-latest-v1"],
  { revalidate: 180 },
);

export const getCachedPoolDaily = unstable_cache(
  async (tsCodes: string, startDate: string, endDate: string) => withFetchTime(queryTushare<TushareDailyRow>(
    "daily",
    { ts_code: tsCodes, start_date: startDate, end_date: endDate },
    DAILY_FIELDS,
  )),
  ["tushare-pool-daily-v2"],
  { revalidate: 1800 },
);

export const getCachedMarketDay = unstable_cache(
  async (tradeDate: string) => withFetchTime(queryTushare<TushareDailyRow>(
    "daily",
    { trade_date: tradeDate },
    DAILY_FIELDS,
  )),
  ["tushare-market-day-v2"],
  { revalidate: 180 },
);

export const getCachedStockBasic = unstable_cache(
  async () => withFetchTime(queryTushare<TushareStockBasicRow>(
    "stock_basic",
    { exchange: "", list_status: "L" },
    STOCK_BASIC_FIELDS,
  )),
  ["tushare-stock-basic-v2"],
  { revalidate: 1800 },
);
