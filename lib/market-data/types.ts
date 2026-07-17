export type SessionKey = "premarket" | "intraday" | "afterhours";
export type RiskLevel = "低" | "中" | "高";
export type DataMode = "close" | "delayed" | "realtime" | "unavailable";
export type MarketSource = "tushare" | "hybrid" | "unavailable";

export interface DailyBar {
  tsCode: string;
  tradeDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  preClose: number;
  changePct: number;
  volume: number;
  amount: number;
}

export interface KlinePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
}

export interface IndexQuote {
  name: string;
  code: string;
  value: number;
  changePct: number;
  volume: number;
  amount: number;
  spark: number[];
}

export interface MarketBreadth {
  advances: number;
  declines: number;
  flat: number;
  turnoverBillion: number;
  turnoverChangePct: number;
  sentiment: string;
  sentimentScore: number;
}

export interface SectorQuote {
  name: string;
  changePct: number;
  leadingStock: string;
  breadth: number;
  heat: number;
  sampleSize: number;
}

export interface FactorMetrics {
  trendStrength: number;
  volumeChange: number;
  movingAverage: number;
  relativeStrength: number;
  sectorHeat: number;
  riskControl: number;
}

export interface TechnicalIndicators {
  ma5: number;
  ma10: number;
  ma20: number;
  high20: number;
  low20: number;
  volumeRatio: number;
  return20: number;
  volatility20: number;
  maxDrawdown60: number;
}

export interface StockCandidate {
  name: string;
  code: string;
  exchange: "SH" | "SZ";
  price: number;
  changePct: number;
  volume: number;
  amount: number;
  industry: string;
  focusRange: [number, number];
  support: number;
  resistance: number;
  stopLoss: number;
  riskLevel: RiskLevel;
  factors: FactorMetrics;
  factorContributions: FactorMetrics;
  indicators: TechnicalIndicators;
  kline60: KlinePoint[];
  tags: string[];
  score: number;
  reason: string;
}

export interface SessionInsight {
  key: SessionKey;
  eyebrow: string;
  title: string;
  description: string;
  focus: string[];
}

export interface MarketSnapshot {
  available: boolean;
  source: MarketSource;
  sourceLabel: string;
  dataMode: DataMode;
  dataModeLabel: string;
  asOf: string;
  updatedAt: string | null;
  statusMessage: string;
  indices: IndexQuote[];
  breadth: MarketBreadth;
  sectors: SectorQuote[];
  candidates: StockCandidate[];
  poolSize: number;
  insight: SessionInsight;
}

export interface MarketStatus {
  tokenConfigured: boolean;
  connected: boolean;
  lastSuccessAt: string | null;
  isRealData: boolean;
  source: MarketSource;
  dataMode: DataMode;
  message: string;
}

export interface TushareDailyRow {
  ts_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  pre_close: number;
  pct_chg: number;
  vol: number;
  amount: number;
}

export interface TushareStockBasicRow {
  ts_code: string;
  symbol: string;
  name: string;
  industry: string | null;
  market: string;
  exchange: string;
}
