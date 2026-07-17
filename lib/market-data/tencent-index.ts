import "server-only";

import type { DailyBar } from "./types";

const INDEX_SYMBOLS: Record<string, string> = {
  "000001.SH": "sh000001",
  "399001.SZ": "sz399001",
  "399006.SZ": "sz399006",
};

interface TencentIndexResponse {
  code: number;
  msg?: string;
  data?: Record<string, {
    day?: string[][];
    qfqday?: string[][];
    qt?: Record<string, string[]>;
  }>;
}

function finiteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function quoteAmountInThousands(quote: string[]) {
  const rawAmount = quote[35]?.split("/")[2];
  return finiteNumber(rawAmount) / 1_000;
}

export async function queryTencentIndex(tsCode: string): Promise<DailyBar[]> {
  const symbol = INDEX_SYMBOLS[tsCode];
  if (!symbol) throw new Error(`腾讯指数代码未配置：${tsCode}`);

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
    if (!response.ok) throw new Error(`腾讯指数行情 HTTP ${response.status}`);

    const payload = await response.json() as TencentIndexResponse;
    const series = payload.data?.[symbol];
    const dayRows = series?.day ?? series?.qfqday;
    const quote = series?.qt?.[symbol];
    if (payload.code !== 0 || !dayRows?.length || !quote?.length) {
      throw new Error(payload.msg || "腾讯指数行情返回结构不完整");
    }

    const quoteDate = quote[30]?.slice(0, 8);
    return dayRows.map((row, index) => {
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
      };
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("腾讯指数行情请求超时");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
