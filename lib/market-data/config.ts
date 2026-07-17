const DEFAULT_STOCK_POOL = [
  "600036.SH", "600276.SH", "600309.SH", "600519.SH", "600900.SH",
  "601012.SH", "601088.SH", "601318.SH", "601668.SH", "601899.SH",
  "000001.SZ", "000333.SZ", "000858.SZ", "002027.SZ", "002050.SZ",
  "002129.SZ", "002230.SZ", "002371.SZ", "002415.SZ", "002460.SZ",
  "002475.SZ", "002594.SZ", "002714.SZ", "300014.SZ", "300015.SZ",
  "300033.SZ", "300059.SZ", "300122.SZ", "300124.SZ", "300274.SZ",
  "300308.SZ", "300347.SZ", "300498.SZ", "300750.SZ", "300760.SZ",
] as const;

const STOCK_POOL_INDUSTRIES: Record<string, string> = {
  "600036.SH": "银行",
  "600276.SH": "医药生物",
  "600309.SH": "基础化工",
  "600519.SH": "食品饮料",
  "600900.SH": "公用事业",
  "601012.SH": "电力设备",
  "601088.SH": "煤炭",
  "601318.SH": "非银金融",
  "601668.SH": "建筑装饰",
  "601899.SH": "有色金属",
  "000001.SZ": "银行",
  "000333.SZ": "家用电器",
  "000858.SZ": "食品饮料",
  "002027.SZ": "传媒",
  "002050.SZ": "机械设备",
  "002129.SZ": "电力设备",
  "002230.SZ": "计算机",
  "002371.SZ": "电子",
  "002415.SZ": "计算机",
  "002460.SZ": "有色金属",
  "002475.SZ": "电子",
  "002594.SZ": "汽车",
  "002714.SZ": "农林牧渔",
  "300014.SZ": "电力设备",
  "300015.SZ": "医药生物",
  "300033.SZ": "计算机",
  "300059.SZ": "非银金融",
  "300122.SZ": "医药生物",
  "300124.SZ": "机械设备",
  "300274.SZ": "电力设备",
  "300308.SZ": "通信",
  "300347.SZ": "医药生物",
  "300498.SZ": "农林牧渔",
  "300750.SZ": "电力设备",
  "300760.SZ": "医药生物",
};

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

export function getConfiguredIndustry(tsCode: string) {
  return STOCK_POOL_INDUSTRIES[tsCode] ?? "其他";
}
