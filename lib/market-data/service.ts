import { INDEX_CONFIG, getConfiguredIndustry, getConfiguredStockPool } from "./config";
import {
  getCachedIndexDaily,
  getCachedMarketDay,
  getCachedPoolDaily,
  getCachedStockBasic,
  getCachedTencentIndexDaily,
  getCachedTencentStockDaily,
} from "./cached-source";
import { clamp, createCandidateDraft, finalizeCandidate, type CandidateDraft } from "./scoring";
import { hasTushareToken, MarketDataError } from "./tushare-client";
import type { TencentMarketStats } from "./tencent-index";
import type {
  DailyBar,
  IndexQuote,
  MarketBreadth,
  MarketSnapshot,
  MarketStatus,
  SectorQuote,
  SessionInsight,
  SessionKey,
  TushareDailyRow,
} from "./types";

function apiDate(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function displayDate(value: string) {
  if (value.length !== 8) return value;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function lookbackDate(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return apiDate(date);
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function toDailyBar(row: TushareDailyRow): DailyBar {
  return {
    tsCode: row.ts_code,
    tradeDate: row.trade_date,
    open: number(row.open),
    high: number(row.high),
    low: number(row.low),
    close: number(row.close),
    preClose: number(row.pre_close),
    changePct: number(row.pct_chg),
    volume: number(row.vol),
    amount: number(row.amount),
  };
}

interface IndexSeries {
  rows: DailyBar[];
  fetchedAt: string;
  source: "tushare" | "tencent";
  marketStats: TencentMarketStats | null;
}

async function getIndexSeries(tsCode: string, startDate: string, endDate: string): Promise<IndexSeries> {
  try {
    const payload = await getCachedIndexDaily(tsCode, startDate, endDate);
    return {
      rows: payload.rows.map(toDailyBar),
      fetchedAt: payload.fetchedAt,
      source: "tushare",
      marketStats: null,
    };
  } catch (tushareError) {
    console.warn(
      `[market-data] Tushare index_daily unavailable for ${tsCode}; using Tencent index data.`,
      tushareError instanceof Error ? tushareError.message : "unknown error",
    );
    const payload = await getCachedTencentIndexDaily(tsCode);
    return { ...payload, source: "tencent" };
  }
}

interface PoolSeries {
  rows: DailyBar[];
  names: Map<string, string>;
  fetchedAt: string;
  source: "tushare" | "tencent";
}

async function getPoolSeries(tsCodes: string[], startDate: string, endDate: string): Promise<PoolSeries> {
  try {
    const payload = await getCachedPoolDaily(tsCodes.join(","), startDate, endDate);
    if (!payload.rows.length) throw new Error("Tushare 股票日线未返回数据");
    return {
      rows: payload.rows.map(toDailyBar),
      names: new Map(),
      fetchedAt: payload.fetchedAt,
      source: "tushare",
    };
  } catch (tushareError) {
    console.warn(
      "[market-data] Tushare daily unavailable; using Tencent stock data.",
      tushareError instanceof Error ? tushareError.message : "unknown error",
    );
    const payloads = await Promise.all(tsCodes.map((tsCode) => getCachedTencentStockDaily(tsCode)));
    if (payloads.some((payload) => payload.rows.length < 60)) {
      throw new Error("腾讯股票历史数据不足 60 个交易日");
    }
    return {
      rows: payloads.flatMap((payload) => payload.rows),
      names: new Map(payloads.map((payload, index) => [tsCodes[index], payload.name])),
      fetchedAt: payloads.map((payload) => payload.fetchedAt).sort().at(-1)!,
      source: "tencent",
    };
  }
}

async function getStockBasicsSafely() {
  try {
    return await getCachedStockBasic();
  } catch (error) {
    console.warn(
      "[market-data] Tushare stock_basic unavailable; using configured industry metadata.",
      error instanceof Error ? error.message : "unknown error",
    );
    return { rows: [], fetchedAt: null };
  }
}

function createInsight(session: SessionKey, tradeDate: string, delayedStocks = false): SessionInsight {
  const date = displayDate(tradeDate);
  if (delayedStocks) {
    const delayedInsights: Record<SessionKey, SessionInsight> = {
      premarket: {
        key: "premarket",
        eyebrow: `盘前研判 · 基于 ${date} 最近可用行情`,
        title: "先看真实结构，再等待开盘确认",
        description: "基于腾讯真实日线与延时行情计算趋势、量能、均线和风险指标；数据不是逐秒实时行情。",
        focus: ["核对开盘偏离幅度", "观察行业强弱延续", "预设技术失效条件"],
      },
      intraday: {
        key: "intraday",
        eyebrow: `盘中参考 · ${date} 延时行情`,
        title: "用真实延时行情跟踪候选结构",
        description: "当前股票和指数来自腾讯延时行情，不是逐秒实时数据；评分仍基于至少 60 个交易日真实 K 线。",
        focus: ["留意数据延时", "等待价格与量能确认", "控制单笔研究风险"],
      },
      afterhours: {
        key: "afterhours",
        eyebrow: `盘后复盘 · ${date} 最近行情`,
        title: "用真实日线复核趋势、量能与风险",
        description: "候选池由真实 K 线动态评分生成，用于后续研究准备，并非直接交易信号。",
        focus: ["复核均线结构", "拆解成交量变化", "更新支撑与压力区间"],
      },
    };
    return delayedInsights[session];
  }
  const insights: Record<SessionKey, SessionInsight> = {
    premarket: {
      key: "premarket",
      eyebrow: `盘前研判 · 基于 ${date} 收盘`,
      title: "先看真实结构，再等开盘确认",
      description: "基于最近可用日线、量能、均线与板块强度生成研究候选；盘前不包含集合竞价实时数据。",
      focus: ["核对开盘偏离幅度", "观察板块延续性", "预设技术失效条件"],
    },
    intraday: {
      key: "intraday",
      eyebrow: `盘中参考 · 最近收盘 ${date}`,
      title: "盘中页面展示最近可用收盘快照",
      description: "Tushare 日线不是逐秒行情。本页用于盘中研究参考，价格与评分均基于最近成功入库的收盘数据。",
      focus: ["不把收盘价当作盘中现价", "等待盘中价格确认", "控制单笔研究风险"],
    },
    afterhours: {
      key: "afterhours",
      eyebrow: `盘后复盘 · ${date} 收盘`,
      title: "用真实收盘数据复核趋势与风险",
      description: "最近至少60个交易日已纳入计算，候选池用于后续研究准备，并非直接交易信号。",
      focus: ["复核均线结构", "拆解成交量变化", "更新支撑与压力区间"],
    },
  };
  return insights[session];
}

function unavailableInsight(session: SessionKey): SessionInsight {
  const labels = { premarket: "盘前研判", intraday: "盘中参考", afterhours: "盘后复盘" } as const;
  return {
    key: session,
    eyebrow: `${labels[session]} · 数据连接状态`,
    title: "行情暂时不可用",
    description: "真实行情接口尚未成功返回数据。系统不会自动回退为未标注的模拟行情。",
    focus: ["检查服务端 Token", "确认 Tushare 接口权限", "稍后重新加载页面"],
  };
}

function emptyBreadth(): MarketBreadth {
  return {
    advances: 0,
    declines: 0,
    flat: 0,
    turnoverBillion: 0,
    turnoverChangePct: 0,
    sentiment: "不可用",
    sentimentScore: 0,
  };
}

function failureSnapshot(session: SessionKey, message: string): MarketSnapshot {
  return {
    available: false,
    source: "unavailable",
    sourceLabel: "行情连接失败",
    dataMode: "unavailable",
    dataModeLabel: "行情暂时不可用",
    asOf: "—",
    updatedAt: null,
    statusMessage: message,
    indices: [],
    breadth: emptyBreadth(),
    sectors: [],
    candidates: [],
    poolSize: getConfiguredStockPool().length,
    insight: unavailableInsight(session),
  };
}

function buildSectors(drafts: CandidateDraft[]) {
  const grouped = new Map<string, CandidateDraft[]>();
  for (const draft of drafts) {
    const group = grouped.get(draft.industry) ?? [];
    group.push(draft);
    grouped.set(draft.industry, group);
  }

  const sectors: SectorQuote[] = Array.from(grouped.entries()).map(([name, members]) => {
    const latestChanges = members.map((member) => member.bars.at(-1)!.changePct);
    const averageChange = mean(latestChanges);
    const averageReturn20 = mean(members.map((member) => member.indicators.return20));
    const breadth = (latestChanges.filter((value) => value > 0).length / members.length) * 100;
    const heat = clamp(50 + averageChange * 4 + averageReturn20 * 1.5 + (breadth - 50) * 0.4);
    const leader = [...members].sort((a, b) => b.bars.at(-1)!.changePct - a.bars.at(-1)!.changePct)[0];
    return {
      name,
      changePct: round(averageChange),
      leadingStock: leader.name,
      breadth: Math.round(breadth),
      heat: Math.round(heat),
      sampleSize: members.length,
    };
  }).sort((a, b) => b.heat - a.heat);

  return {
    sectors: sectors.slice(0, 5),
    heatByIndustry: new Map(sectors.map((sector) => [sector.name, sector.heat])),
  };
}

function buildBreadth(todayRows: TushareDailyRow[], previousRows: TushareDailyRow[]): MarketBreadth {
  const advances = todayRows.filter((row) => number(row.pct_chg) > 0).length;
  const declines = todayRows.filter((row) => number(row.pct_chg) < 0).length;
  const flat = Math.max(0, todayRows.length - advances - declines);
  const turnover = todayRows.reduce((sum, row) => sum + number(row.amount), 0);
  const previousTurnover = previousRows.reduce((sum, row) => sum + number(row.amount), 0);
  const turnoverChangePct = previousTurnover > 0 ? ((turnover / previousTurnover) - 1) * 100 : 0;
  const advanceRatio = todayRows.length ? (advances / todayRows.length) * 100 : 50;
  const sentimentScore = Math.round(clamp(50 + (advanceRatio - 50) * 0.72 + clamp(turnoverChangePct, -20, 20) * 0.45));
  const sentiment = sentimentScore >= 70 ? "积极" : sentimentScore >= 58 ? "偏暖" : sentimentScore >= 45 ? "中性" : "谨慎";

  return {
    advances,
    declines,
    flat,
    turnoverBillion: round(turnover / 100_000, 1),
    turnoverChangePct: round(turnoverChangePct, 1),
    sentiment,
    sentimentScore,
  };
}

function buildTencentBreadth(indexSeries: IndexSeries[]): MarketBreadth {
  const marketStats = indexSeries.slice(0, 2).map((series) => series.marketStats).filter(
    (stats): stats is TencentMarketStats => stats !== null,
  );
  if (!marketStats.length) throw new Error("腾讯市场涨跌家数暂时不可用");

  const advances = marketStats.reduce((sum, stats) => sum + stats.advances, 0);
  const declines = marketStats.reduce((sum, stats) => sum + stats.declines, 0);
  const flat = marketStats.reduce((sum, stats) => sum + stats.flat, 0);
  const total = advances + declines + flat;
  const turnover = indexSeries.slice(0, 2).reduce((sum, series) => sum + (series.rows.at(-1)?.amount ?? 0), 0);
  const advanceRatio = total ? (advances / total) * 100 : 50;
  const sentimentScore = Math.round(clamp(50 + (advanceRatio - 50) * 0.9));
  const sentiment = sentimentScore >= 70 ? "积极" : sentimentScore >= 58 ? "偏暖" : sentimentScore >= 45 ? "中性" : "谨慎";

  return {
    advances,
    declines,
    flat,
    turnoverBillion: round(turnover / 100_000, 1),
    turnoverChangePct: 0,
    sentiment,
    sentimentScore,
  };
}

export async function getMarketSnapshot(session: SessionKey): Promise<MarketSnapshot> {
  if (!hasTushareToken()) return failureSnapshot(session, "未配置 TUSHARE_TOKEN");

  try {
    const endDate = apiDate(new Date());
    const indexStartDate = lookbackDate(140);
    const pool = getConfiguredStockPool();
    const poolStartDate = lookbackDate(190);
    const [indexPayloads, poolSeries, basicPayload] = await Promise.all([
      Promise.all(INDEX_CONFIG.map((index) => getIndexSeries(index.code, indexStartDate, endDate))),
      getPoolSeries(pool, poolStartDate, endDate),
      getStockBasicsSafely(),
    ]);

    const indexBars = indexPayloads.map((payload) => payload.rows.sort((a, b) => a.tradeDate.localeCompare(b.tradeDate)));
    if (indexBars.some((bars) => bars.length < 21)) throw new Error("指数历史数据不足");

    const poolTradeDates = Array.from(new Set(poolSeries.rows.map((row) => row.tradeDate))).sort();
    if (poolTradeDates.length < 2) throw new Error("股票池历史数据不足");
    const latestTradeDate = poolTradeDates.at(-1)!;
    const previousTradeDate = poolTradeDates.at(-2)!;
    let breadth: MarketBreadth;
    let marketFetchedAt: string | null = null;
    let breadthSource: "tushare" | "tencent" = "tushare";
    try {
      const [marketTodayPayload, marketPreviousPayload] = await Promise.all([
        getCachedMarketDay(latestTradeDate),
        getCachedMarketDay(previousTradeDate),
      ]);
      if (!marketTodayPayload.rows.length) throw new Error("Tushare 全市场日线未返回数据");
      breadth = buildBreadth(marketTodayPayload.rows, marketPreviousPayload.rows);
      marketFetchedAt = marketTodayPayload.fetchedAt;
    } catch (error) {
      console.warn(
        "[market-data] Tushare market breadth unavailable; using Tencent market counts.",
        error instanceof Error ? error.message : "unknown error",
      );
      breadth = buildTencentBreadth(indexPayloads);
      breadthSource = "tencent";
    }

    const basicByCode = new Map(basicPayload.rows.map((row) => [row.ts_code, row]));
    const barsByCode = new Map<string, DailyBar[]>();
    for (const bar of poolSeries.rows) {
      const rows = barsByCode.get(bar.tsCode) ?? [];
      rows.push(bar);
      barsByCode.set(bar.tsCode, rows);
    }

    const shanghaiBars = indexBars[0].filter((bar) => bar.tradeDate <= latestTradeDate);
    if (shanghaiBars.length < 21) throw new Error("指数与股票日线日期无法对齐");
    const benchmarkBase = shanghaiBars.at(-21)!.close;
    const benchmarkReturn20 = ((shanghaiBars.at(-1)!.close / benchmarkBase) - 1) * 100;
    const drafts = pool.map((tsCode) => {
      const basic = basicByCode.get(tsCode);
      return createCandidateDraft(
        tsCode,
        poolSeries.names.get(tsCode) ?? basic?.name ?? tsCode.slice(0, 6),
        basic?.industry || getConfiguredIndustry(tsCode),
        barsByCode.get(tsCode) ?? [],
        benchmarkReturn20,
      );
    }).filter((draft): draft is CandidateDraft => draft !== null);

    const { sectors, heatByIndustry } = buildSectors(drafts);
    const candidates = drafts
      .map((draft) => finalizeCandidate(draft, heatByIndustry.get(draft.industry) ?? 50))
      .filter((candidate) => candidate.score >= 68)
      .sort((a, b) => b.score - a.score);

    const indices: IndexQuote[] = INDEX_CONFIG.map((config, index) => {
      const bars = indexBars[index];
      const latest = bars.at(-1)!;
      return {
        name: config.name,
        code: config.code,
        value: latest.close,
        changePct: latest.changePct,
        volume: latest.volume,
        amount: latest.amount,
        spark: bars.slice(-30).map((bar) => bar.close),
      };
    });

    const updatedAt = [
      ...indexPayloads.map((payload) => payload.fetchedAt),
      poolSeries.fetchedAt,
      basicPayload.fetchedAt,
      marketFetchedAt,
    ].filter((value): value is string => Boolean(value)).sort().at(-1)!;

    const usesTencentIndices = indexPayloads.some((payload) => payload.source === "tencent");
    const usesTencentStocks = poolSeries.source === "tencent";
    const source = usesTencentStocks
      ? "tencent"
      : usesTencentIndices || breadthSource === "tencent" ? "hybrid" : "tushare";

    return {
      available: true,
      source,
      sourceLabel: source === "tencent"
        ? "腾讯行情 · 真实延时数据（Tushare 权限不足）"
        : source === "hybrid" ? "Tushare Pro + 腾讯行情 · 真实数据" : "Tushare Pro · 真实行情",
      dataMode: source === "tushare" ? "close" : "delayed",
      dataModeLabel: source === "tencent"
        ? "股票与指数延时行情 · 非逐秒实时"
        : source === "hybrid" ? "指数延时行情 + 股票收盘数据 · 非逐秒实时" : "收盘数据 · 非逐秒实时",
      asOf: source === "tencent"
        ? `${displayDate(latestTradeDate)} 延时行情`
        : source === "hybrid" ? `${displayDate(latestTradeDate)} 股票收盘 / 指数延时` : `${displayDate(latestTradeDate)} 收盘`,
      updatedAt,
      statusMessage: source === "tencent"
        ? "真实行情连接正常（Tushare 无日线权限，当前使用腾讯延时行情）"
        : source === "hybrid" ? "真实行情连接正常（Tushare 日线 + 腾讯指数）" : "行情接口连接正常",
      indices,
      breadth,
      sectors,
      candidates,
      poolSize: pool.length,
      insight: createInsight(session, latestTradeDate, usesTencentStocks),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "真实行情数据处理失败";
    console.error("[market-data] Tushare snapshot failed:", message);
    return failureSnapshot(session, "行情暂时不可用");
  }
}

export async function getMarketStatus(): Promise<MarketStatus> {
  if (!hasTushareToken()) {
    return {
      tokenConfigured: false,
      connected: false,
      lastSuccessAt: null,
      isRealData: false,
      source: "unavailable",
      dataMode: "unavailable",
      message: "未配置 TUSHARE_TOKEN",
    };
  }

  try {
    const endDate = apiDate(new Date());
    const [stockPayload, indexPayload] = await Promise.all([
      getPoolSeries(["600036.SH"], lookbackDate(190), endDate),
      getIndexSeries("000001.SH", lookbackDate(140), endDate),
    ]);
    if (!stockPayload.rows.length || !indexPayload.rows.length) throw new Error("真实行情接口未返回数据");
    const source = stockPayload.source === "tencent"
      ? "tencent"
      : indexPayload.source === "tencent" ? "hybrid" : "tushare";
    return {
      tokenConfigured: true,
      connected: true,
      lastSuccessAt: [stockPayload.fetchedAt, indexPayload.fetchedAt].sort().at(-1)!,
      isRealData: true,
      source,
      dataMode: source === "tushare" ? "close" : "delayed",
      message: source === "tencent"
        ? "真实行情连接正常：Tushare 日线权限不足，当前股票和指数使用腾讯延时行情"
        : source === "hybrid"
          ? "真实行情连接正常：股票为 Tushare Pro 收盘数据，指数为腾讯延时行情"
          : "Tushare Pro 连接正常，当前提供收盘数据",
    };
  } catch (error) {
    const message = error instanceof MarketDataError ? error.message : "行情接口未返回数据";
    return {
      tokenConfigured: true,
      connected: false,
      lastSuccessAt: null,
      isRealData: false,
      source: "unavailable",
      dataMode: "unavailable",
      message,
    };
  }
}

export function isSessionKey(value: string): value is SessionKey {
  return ["premarket", "intraday", "afterhours"].includes(value);
}
