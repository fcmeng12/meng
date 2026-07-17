import type {
  DailyBar,
  FactorMetrics,
  RiskLevel,
  StockCandidate,
  TechnicalIndicators,
} from "./types";

export const FACTOR_WEIGHTS: Record<keyof FactorMetrics, number> = {
  trendStrength: 0.24,
  volumeChange: 0.18,
  movingAverage: 0.18,
  relativeStrength: 0.16,
  sectorHeat: 0.14,
  riskControl: 0.1,
};

const FACTOR_LABELS: Record<keyof FactorMetrics, string> = {
  trendStrength: "趋势强度",
  volumeChange: "量能变化",
  movingAverage: "均线状态",
  relativeStrength: "相对强弱",
  sectorHeat: "板块热度",
  riskControl: "风险控制",
};

export interface CandidateDraft {
  tsCode: string;
  name: string;
  industry: string;
  bars: DailyBar[];
  factors: Omit<FactorMetrics, "sectorHeat">;
  indicators: TechnicalIndicators;
  riskLevel: RiskLevel;
  tags: string[];
}

export function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function movingAverage(bars: DailyBar[], window: number, offset = 0) {
  const end = bars.length - offset;
  const sample = bars.slice(Math.max(0, end - window), end);
  return mean(sample.map((bar) => bar.close));
}

function maxDrawdown(bars: DailyBar[]) {
  let peak = bars[0]?.close ?? 0;
  let maximum = 0;
  for (const bar of bars) {
    peak = Math.max(peak, bar.close);
    if (peak > 0) maximum = Math.max(maximum, ((peak - bar.close) / peak) * 100);
  }
  return maximum;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function createCandidateDraft(
  tsCode: string,
  name: string,
  industry: string,
  inputBars: DailyBar[],
  benchmarkReturn20: number,
): CandidateDraft | null {
  const bars = [...inputBars].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  if (bars.length < 60) return null;

  const latest = bars.at(-1)!;
  const last20 = bars.slice(-20);
  const last60 = bars.slice(-60);
  const ma5 = movingAverage(bars, 5);
  const ma10 = movingAverage(bars, 10);
  const ma20 = movingAverage(bars, 20);
  const previousMa20 = movingAverage(bars, 20, 1);
  const high20 = Math.max(...last20.map((bar) => bar.high));
  const low20 = Math.min(...last20.map((bar) => bar.low));
  const base20 = bars.at(-21)?.close ?? bars[0].close;
  const return20 = ((latest.close / base20) - 1) * 100;
  const previousVolumes = bars.slice(-21, -1).map((bar) => bar.volume);
  const volumeRatio = latest.volume / Math.max(1, mean(previousVolumes));
  const dailyReturns = last20.slice(1).map((bar, index) => {
    const previous = last20[index].close;
    return previous ? ((bar.close / previous) - 1) * 100 : 0;
  });
  const volatility20 = standardDeviation(dailyReturns) * Math.sqrt(252);
  const drawdown60 = maxDrawdown(last60);
  const position20 = high20 === low20 ? 50 : ((latest.close - low20) / (high20 - low20)) * 100;

  const priceVsMa20 = ma20 ? ((latest.close / ma20) - 1) * 100 : 0;
  const maSpread = ma20 ? ((ma5 / ma20) - 1) * 100 : 0;
  const trendStrength = clamp(
    clamp(50 + priceVsMa20 * 5) * 0.25
    + clamp(50 + return20 * 2.5) * 0.3
    + clamp(position20) * 0.25
    + clamp(50 + maSpread * 6) * 0.2,
  );
  const volumeChange = clamp(50 + (volumeRatio - 1) * 45 + (latest.changePct >= 0 ? 10 : -8));
  const movingAverageScore = [
    latest.close >= ma5,
    ma5 >= ma10,
    ma10 >= ma20,
    ma20 >= previousMa20,
  ].filter(Boolean).length * 25;
  const relativeStrength = clamp(50 + (return20 - benchmarkReturn20) * 3);
  const riskControl = clamp(100 - Math.max(0, volatility20 - 15) * 1.35 - drawdown60 * 1.8);

  const riskLevel: RiskLevel = volatility20 > 42 || drawdown60 > 16
    ? "高"
    : volatility20 > 28 || drawdown60 > 10
      ? "中"
      : "低";

  const tags = [
    latest.close >= ma5 && ma5 >= ma10 && ma10 >= ma20 ? "均线多头" : "均线观察",
    volumeRatio >= 1.25 ? "量能放大" : "量能平稳",
    return20 > benchmarkReturn20 ? "强于大盘" : "等待确认",
    position20 >= 75 ? "接近20日高位" : "区间运行",
    riskControl >= 75 ? "回撤受控" : "注意波动",
  ].filter((tag, index, list) => list.indexOf(tag) === index).slice(0, 3);

  return {
    tsCode,
    name,
    industry,
    bars,
    factors: {
      trendStrength: round(trendStrength, 1),
      volumeChange: round(volumeChange, 1),
      movingAverage: round(movingAverageScore, 1),
      relativeStrength: round(relativeStrength, 1),
      riskControl: round(riskControl, 1),
    },
    indicators: {
      ma5: round(ma5),
      ma10: round(ma10),
      ma20: round(ma20),
      high20: round(high20),
      low20: round(low20),
      volumeRatio: round(volumeRatio),
      return20: round(return20),
      volatility20: round(volatility20),
      maxDrawdown60: round(drawdown60),
    },
    riskLevel,
    tags,
  };
}

export function finalizeCandidate(draft: CandidateDraft, sectorHeat: number): StockCandidate {
  const latest = draft.bars.at(-1)!;
  const factors: FactorMetrics = { ...draft.factors, sectorHeat: round(sectorHeat, 1) };
  const keys = Object.keys(FACTOR_WEIGHTS) as (keyof FactorMetrics)[];
  const factorContributions = keys.reduce((result, key) => {
    result[key] = round(factors[key] * FACTOR_WEIGHTS[key], 1);
    return result;
  }, {} as FactorMetrics);
  const score = Math.round(keys.reduce((sum, key) => sum + factorContributions[key], 0));
  const strengths = keys
    .sort((a, b) => factorContributions[b] - factorContributions[a])
    .slice(0, 2)
    .map((key) => FACTOR_LABELS[key]);
  const lowerFocus = Math.min(draft.indicators.ma5, latest.close) * 0.99;
  const upperFocus = Math.max(draft.indicators.ma5, latest.close) * 1.01;

  return {
    name: draft.name,
    code: draft.tsCode.slice(0, 6),
    exchange: draft.tsCode.endsWith(".SH") ? "SH" : "SZ",
    price: round(latest.close),
    changePct: round(latest.changePct),
    volume: round(latest.volume),
    amount: round(latest.amount),
    industry: draft.industry,
    focusRange: [round(lowerFocus), round(upperFocus)],
    support: draft.indicators.low20,
    resistance: draft.indicators.high20,
    stopLoss: round(Math.max(draft.indicators.low20 * 0.98, latest.close * 0.92)),
    riskLevel: draft.riskLevel,
    factors,
    factorContributions,
    indicators: draft.indicators,
    kline60: draft.bars.slice(-60).map((bar) => ({
      date: bar.tradeDate,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      amount: bar.amount,
    })),
    tags: draft.tags,
    score,
    reason: `${strengths.join("与")}在当前股票池中表现居前；评分来自最近至少60个交易日的真实收盘数据。`,
  };
}
