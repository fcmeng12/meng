import "server-only";

import type { DailyBar } from "./types";

export interface TencentMarketStats {
  advances: number;
  declines: number;
  flat: number;
}

export interface TencentSeriesResult {
  rows: DailyBar[];
  name: string;
  marketStats: TencentMarketStats | null;
}

interface TencentSeriesResponse {
  code: number;
  msg?: string;
  data?: Record<string, {
    day?: string[][];
    qfqday?: string[][];
    qt?: {
      zhishu?: string[];
      [key: string]: string[] | undefined;
    };
  }>;
}

function finiteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toTencentSymbol(tsCode: string) {
  const [code, exchange] = tsCode.split(".");
  if (!/^\d{6}$/.test(code) || !["SH", "SZ"].includes(exchange)) {
    throw new Error(`腾讯行情代码格式不正确：${tsCode}`);
  }
  return `${exchange.toLowerCase()}${code}`;
}

function quoteAmountInThousands(quote: string[]) {
  const rawAmount = quote[35]?.split("/")[2];
  return finiteNumber(rawAmount) / 1_000;
}

function parseMarketStats(values?: string[]): TencentMarketStats | null {
  if (!values?.length) return null;
  const advances = finiteNumber(values[2]);
  const flat = finiteNumber(values[3]);
  const declines = finiteNumber(values[4]);
  return advances + flat + declines > 0 ? { advances, declines, flat } : null;
}

async function queryTencentSeries(tsCode: string): Promise<TencentSeriesResult> {
  const symbol = toTencentSymbol(tsCode);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const url = new URL("https://web.ifzq.gtimg.cn/appstock/app/fqkline/get");
    url.searchParams.set("param", `${symbol},day,,,80,qfq`);
    const response = await fetch(url, {
      headers: { "User-Agent": "A-Share-Radar/1.0" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`腾讯行情 HTTP ${response.status}`);

    const payload = await response.json() as TencentSeriesResponse;
    const series = payload.data?.[symbol];
    const dayRows = series?.day ?? series?.qfqday;
    const quote = series?.qt?.[symbol];
    if (payload.code !== 0 || !dayRows?.length || !quote?.length) {
      throw new Error(payload.msg || "腾讯行情返回结构不完整");
    }

    const quoteDate = quote[30]?.slice(0, 8);
    const rows = dayRows.map((row, index) => {
      const tradeDate = row[0].replaceAll("-", "");
      const previousClose = index > 0 ? finiteNumber(dayRows[index - 1][2]) : finiteNumber(row[1]);
      const isLatestQuote = tradeDate === quoteDate;
      const close = isLatestQuote ? finiteNumber(quote[3]) : finiteNumber(row[2]);
      const preClose = isLatestQuote ? finiteNumber(quote[4]) : previousClose;
      return {
        tsCode,
        tradeDate,
        open: finiteNumber(row[1]),
        high: isLatestQuote ? finiteNumber(quote[33]) : finiteNumber(row[3]),
        low: isLatestQuote ? finiteNumber(quote[34]) : finiteNumber(row[4]),
        close,
        preClose,
        changePct: isLatestQuote
          ? finiteNumber(quote[32])
          : preClose > 0 ? ((close / preClose) - 1) * 100 : 0,
        volume: isLatestQuote ? finiteNumber(quote[36]) : finiteNumber(row[5]),
        amount: isLatestQuote ? quoteAmountInThousands(quote) : 0,
      } satisfies DailyBar;
    });

    return {
      rows,
      name: quote[1] || tsCode.slice(0, 6),
      marketStats: parseMarketStats(series?.qt?.zhishu),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("腾讯行情请求超时");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function queryTencentIndex(tsCode: string) {
  return queryTencentSeries(tsCode);
}

export function queryTencentStock(tsCode: string) {
  return queryTencentSeries(tsCode);
}
