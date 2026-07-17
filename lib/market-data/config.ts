const DEFAULT_STOCK_POOL = [
  "600036.SH", "600276.SH", "600309.SH", "600519.SH", "600900.SH",
  "601012.SH", "601088.SH", "601318.SH", "601668.SH", "601899.SH",
  "000001.SZ", "000333.SZ", "000858.SZ", "002027.SZ", "002050.SZ",
  "002129.SZ", "002230.SZ", "002371.SZ", "002415.SZ", "002460.SZ",
  "002475.SZ", "002594.SZ", "002714.SZ", "300014.SZ", "300015.SZ",
  "300033.SZ", "300059.SZ", "300122.SZ", "300124.SZ", "300274.SZ",
  "300308.SZ", "300347.SZ", "300498.SZ", "300750.SZ", "300760.SZ",
] as const;

const STOCK_CODE_PATTERN = /^\d{6}\.(SH|SZ)$/;
const MAX_POOL_SIZE = 45;

export const INDEX_CONFIG = [
  { code: "000001.SH", name: "上证指数" },
  { code: "399001.SZ", name: "深证成指" },
  { code: "399006.SZ", name: "创业板指" },
] as const;

export function getConfiguredStockPool() {
  const configured = process.env.A_SHARE_STOCK_POOL
    ?.split(",")
    .map((code) => code.trim().toUpperCase())
    .filter((code) => STOCK_CODE_PATTERN.test(code));

  const pool = configured?.length ? configured : [...DEFAULT_STOCK_POOL];
  return Array.from(new Set(pool)).slice(0, MAX_POOL_SIZE);
}
