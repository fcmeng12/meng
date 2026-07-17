"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FactorMetrics, MarketSnapshot, RiskLevel, StockCandidate } from "@/lib/market-data";
import { ActivityIcon, ArrowDownIcon, ArrowUpIcon, ChevronIcon, ClockIcon, FilterIcon, InfoIcon, LayersIcon, SearchIcon, ShieldIcon } from "./icons";
import { Sparkline } from "./sparkline";

const sessionNav = [
  { key: "premarket", label: "盘前研判", short: "盘前", href: "/analysis/premarket" },
  { key: "intraday", label: "盘中跟踪", short: "盘中", href: "/analysis/intraday" },
  { key: "afterhours", label: "盘后复盘", short: "盘后", href: "/analysis/afterhours" },
];

const factorLabels: Record<keyof FactorMetrics, string> = {
  trendStrength: "趋势",
  volumeChange: "量能",
  movingAverage: "均线",
  relativeStrength: "相对强弱",
  sectorHeat: "板块热度",
  riskControl: "风控",
};

const riskTone: Record<RiskLevel, string> = { 低: "low", 中: "medium", 高: "high" };

function formatPrice(value: number) {
  return value.toFixed(2);
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatVolume(value: number) {
  return value >= 10_000 ? `${(value / 10_000).toFixed(1)} 万手` : `${value.toFixed(0)} 手`;
}

function formatAmount(value: number) {
  return value >= 100_000 ? `${(value / 100_000).toFixed(2)} 亿元` : `${(value / 1_000).toFixed(1)} 百万元`;
}

function Change({ value, compact = false }: { value: number; compact?: boolean }) {
  const positive = value >= 0;
  return (
    <span className={`change ${positive ? "up" : "down"} ${compact ? "compact" : ""}`}>
      {positive ? <ArrowUpIcon size={compact ? 13 : 15} /> : <ArrowDownIcon size={compact ? 13 : 15} />}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

function Header({ snapshot }: { snapshot: MarketSnapshot }) {
  const status = snapshot.available ? "真实行情" : "行情连接失败";
  return (
    <>
      <header className="site-header">
        <div className="shell header-inner">
          <Link href="/" className="brand" aria-label="见山 A 股雷达首页">
            <span className="brand-mark"><i /><i /><i /></span>
            <span><b>见山</b><small>A-SHARE RADAR</small></span>
          </Link>
          <nav className="session-nav" aria-label="分析时段">
            {sessionNav.map((item) => (
              <Link key={item.key} href={item.href} className={snapshot.insight.key === item.key ? "active" : ""}>
                <span className="desktop-label">{item.label}</span><span className="mobile-label">{item.short}</span>
              </Link>
            ))}
          </nav>
          <div className={`header-status ${snapshot.available ? "connected" : "failed"}`}><i />{status}</div>
        </div>
      </header>
      <div className="disclaimer-bar">
        <div className="shell"><InfoIcon size={16} /><strong>重要声明：</strong>本网站内容仅用于行情研究和信息展示，不构成任何投资建议。</div>
      </div>
    </>
  );
}

function Footer({ snapshot }: { snapshot: MarketSnapshot }) {
  return (
    <footer>
      <div className="shell footer-inner">
        <div className="footer-brand"><span className="brand-mark"><i /><i /><i /></span><p><b>见山 A 股雷达</b><span>理性研究 · 尊重风险 · 保持独立判断</span></p></div>
        <p className="footer-warning"><InfoIcon size={15} />本网站内容仅用于行情研究和信息展示，不构成任何投资建议。</p>
        <span className="footer-meta">{snapshot.available ? `${snapshot.sourceLabel} · ${snapshot.dataModeLabel}` : "行情暂时不可用"}</span>
      </div>
    </footer>
  );
}

function CandidateCard({ stock, rank, priceLabel }: { stock: StockCandidate; rank: number; priceLabel: string }) {
  const closeSeries = stock.kline60.map((point) => point.close);
  return (
    <article className="stock-card">
      <div className="stock-card-top">
        <div className="stock-identity">
          <span className="stock-rank">{String(rank).padStart(2, "0")}</span>
          <div>
            <div className="stock-name-row">
              <h3>{stock.name}</h3>
              <span className={`risk-badge ${riskTone[stock.riskLevel]}`}><ShieldIcon size={13} />{stock.riskLevel}风险</span>
            </div>
            <p>{stock.code}.{stock.exchange} · {stock.industry}</p>
          </div>
        </div>
        <div className="score-ring" style={{ background: `conic-gradient(#f0b55a ${stock.score * 3.6}deg, rgba(255,255,255,.08) 0deg)` }}>
          <div><strong>{stock.score}</strong><span>评分</span></div>
        </div>
      </div>

      <div className="quote-row real-quote-row">
        <div><span className="eyelabel">{priceLabel}</span><strong>¥ {formatPrice(stock.price)}</strong></div>
        <Sparkline values={closeSeries.slice(-30)} positive={stock.changePct >= 0} />
        <Change value={stock.changePct} />
      </div>

      <div className="quote-meta-grid">
        <div><span>成交量</span><b>{formatVolume(stock.volume)}</b></div>
        <div><span>成交额</span><b>{formatAmount(stock.amount)}</b></div>
        <div><span>量比（20日）</span><b>{stock.indicators.volumeRatio.toFixed(2)}</b></div>
        <div><span>20日涨跌</span><b className={stock.indicators.return20 >= 0 ? "red" : "green"}>{stock.indicators.return20.toFixed(2)}%</b></div>
      </div>

      <div className="tag-row">{stock.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
      <div className="reason-box"><span className="reason-marker" /><p><b>入选逻辑</b>{stock.reason}</p></div>

      <div className="technical-grid">
        <div><span>MA5</span><strong>{formatPrice(stock.indicators.ma5)}</strong></div>
        <div><span>MA10</span><strong>{formatPrice(stock.indicators.ma10)}</strong></div>
        <div><span>MA20</span><strong>{formatPrice(stock.indicators.ma20)}</strong></div>
        <div><span>20日最高</span><strong>{formatPrice(stock.indicators.high20)}</strong></div>
        <div><span>20日最低</span><strong>{formatPrice(stock.indicators.low20)}</strong></div>
      </div>

      <div className="levels-grid">
        <div className="focus-cell"><span>参考关注区间</span><strong>{formatPrice(stock.focusRange[0])} — {formatPrice(stock.focusRange[1])}</strong></div>
        <div><span>支撑位</span><strong>{formatPrice(stock.support)}</strong></div>
        <div><span>压力位</span><strong>{formatPrice(stock.resistance)}</strong></div>
        <div><span>止损参考</span><strong className="stop-value">{formatPrice(stock.stopLoss)}</strong></div>
      </div>

      <details className="factor-details">
        <summary>查看六因子与60日K线明细 <ChevronIcon size={15} /></summary>
        <div className="factor-grid">
          {(Object.keys(factorLabels) as (keyof FactorMetrics)[]).map((key) => (
            <div className="factor-item" key={key}>
              <div><span>{factorLabels[key]}</span><b>{stock.factors[key].toFixed(1)}</b></div>
              <i><em style={{ width: `${stock.factors[key]}%` }} /></i>
            </div>
          ))}
        </div>
        <div className="kline-note">已载入 {stock.kline60.length} 个交易日真实K线 · 年化波动 {stock.indicators.volatility20.toFixed(1)}% · 60日最大回撤 {stock.indicators.maxDrawdown60.toFixed(1)}%</div>
      </details>
    </article>
  );
}

export function Dashboard({ snapshot }: { snapshot: MarketSnapshot }) {
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("全部行业");
  const [risk, setRisk] = useState<"全部" | RiskLevel>("全部");
  const [sort, setSort] = useState("score-desc");

  const industries = useMemo(() => ["全部行业", ...Array.from(new Set(snapshot.candidates.map((item) => item.industry)))], [snapshot.candidates]);
  const filteredStocks = useMemo(() => snapshot.candidates
    .filter((stock) => !query.trim() || stock.name.toLowerCase().includes(query.trim().toLowerCase()) || stock.code.includes(query.trim()))
    .filter((stock) => industry === "全部行业" || stock.industry === industry)
    .filter((stock) => risk === "全部" || stock.riskLevel === risk)
    .sort((a, b) => sort === "score-asc" ? a.score - b.score : sort === "change-desc" ? b.changePct - a.changePct : b.score - a.score),
  [snapshot.candidates, query, industry, risk, sort]);

  const breadthTotal = snapshot.breadth.advances + snapshot.breadth.declines + snapshot.breadth.flat;
  const advanceRatio = breadthTotal ? (snapshot.breadth.advances / breadthTotal) * 100 : 0;

  if (!snapshot.available) {
    return (
      <main>
        <div className="ambient ambient-one" /><div className="ambient ambient-two" />
        <Header snapshot={snapshot} />
        <div className="shell page-content failure-page">
          <section className="failure-panel">
            <span className="failure-icon">!</span>
            <p className="hero-eyebrow">MARKET DATA CONNECTION</p>
            <h1>行情暂时不可用</h1>
            <p>{snapshot.statusMessage}。系统没有回退到未标注的模拟价格，请检查服务端行情配置后重试。</p>
            <div className="failure-checks">
              <span><b>01</b>确认 Vercel 已配置 TUSHARE_TOKEN</span>
              <span><b>02</b>确认 Token 拥有 daily、stock_basic 权限，并检查腾讯指数连接</span>
              <span><b>03</b>访问 <Link href="/api/market/status">/api/market/status</Link> 检查连接状态</span>
            </div>
          </section>
        </div>
        <Footer snapshot={snapshot} />
      </main>
    );
  }

  return (
    <main>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <Header snapshot={snapshot} />

      <div className="shell page-content">
        <section className="hero">
          <div className="hero-copy">
            <div className="source-line">
              <span className="source-badge"><i />{snapshot.sourceLabel}</span>
              <span className="data-mode-badge">{snapshot.dataModeLabel}</span>
              <span><ClockIcon size={14} />数据时点 {snapshot.asOf}</span>
              <span>最近更新 {formatUpdatedAt(snapshot.updatedAt)}</span>
            </div>
            <p className="hero-eyebrow">{snapshot.insight.eyebrow}</p>
            <h1>{snapshot.insight.title}</h1>
            <p className="hero-description">{snapshot.insight.description}</p>
            <div className="focus-list">{snapshot.insight.focus.map((focus, index) => <span key={focus}><b>0{index + 1}</b>{focus}</span>)}</div>
          </div>
          <div className="sentiment-card">
            <div className="sentiment-heading"><span><ActivityIcon size={17} />市场温度</span><small>MARKET PULSE</small></div>
            <div className="pulse-wrap"><div className="pulse-orbit"><i /><i /><i /></div><div className="pulse-score"><strong>{snapshot.breadth.sentimentScore}</strong><span>/ 100</span><b>{snapshot.breadth.sentiment}</b></div></div>
            <div className="breadth-mini"><div><span>上涨占比</span><b>{advanceRatio.toFixed(0)}%</b></div><i><em style={{ width: `${advanceRatio}%` }} /></i><p>基于全市场最近交易日涨跌家数与成交额计算</p></div>
          </div>
        </section>

        <section className="indices-section" aria-labelledby="market-title">
          <div className="section-heading"><div><span className="section-index">01</span><div><p>MARKET OVERVIEW</p><h2 id="market-title">核心指数</h2></div></div><span className="section-note">{snapshot.source === "tencent" ? "腾讯指数延时行情 · 非逐秒实时" : snapshot.source === "hybrid" ? "腾讯指数延时行情 · 股票为 Tushare 收盘数据" : "Tushare Pro 最近可用收盘数据"}</span></div>
          <div className="index-grid">
            {snapshot.indices.map((index) => (
              <article className="index-card" key={index.code}>
                <div className="index-info"><span>{index.name}</span><small>{index.code}</small><strong>{index.value.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</strong><Change value={index.changePct} compact /></div>
                <Sparkline values={index.spark} positive={index.changePct >= 0} />
              </article>
            ))}
            <article className="index-card market-breadth-card">
              <div className="breadth-numbers"><div><span>上涨</span><strong className="red">{snapshot.breadth.advances}</strong></div><div><span>下跌</span><strong className="green">{snapshot.breadth.declines}</strong></div><div><span>平盘</span><strong>{snapshot.breadth.flat}</strong></div></div>
              <div className="split-bar"><i style={{ width: `${advanceRatio}%` }} /><em /></div>
              <div className="turnover-line"><span>两市成交额</span><strong>{snapshot.breadth.turnoverBillion.toFixed(1)} <small>亿元</small></strong><b>{snapshot.source === "tencent" ? "延时累计" : `较前日 ${snapshot.breadth.turnoverChangePct >= 0 ? "+" : ""}${snapshot.breadth.turnoverChangePct}%`}</b></div>
            </article>
          </div>
        </section>

        <section className="sector-section" aria-labelledby="sector-title">
          <div className="section-heading compact-heading"><div><span className="section-index">02</span><div><p>SECTOR MOMENTUM</p><h2 id="sector-title">股票池行业热度</h2></div></div><span className="section-note">基于配置股票池真实行情计算</span></div>
          <div className="sector-board">
            <div className="sector-head"><span>排名 / 行业</span><span>平均涨跌</span><span>领涨标的</span><span>上涨占比</span><span>热度</span></div>
            {snapshot.sectors.map((sector, index) => (
              <div className="sector-row" key={sector.name}>
                <div><b>0{index + 1}</b><strong>{sector.name} <small>样本{sector.sampleSize}</small></strong></div><Change value={sector.changePct} compact /><span>{sector.leadingStock}</span>
                <div className="breadth-cell"><i><em style={{ width: `${sector.breadth}%` }} /></i><b>{sector.breadth}%</b></div><div className="heat-cell"><span>{sector.heat}</span><i><em style={{ width: `${sector.heat}%` }} /></i></div>
              </div>
            ))}
          </div>
        </section>

        <section className="candidates-section" aria-labelledby="candidate-title">
          <div className="section-heading candidate-heading"><div><span className="section-index">03</span><div><p>MULTI-FACTOR WATCHLIST</p><h2 id="candidate-title">动态股票候选池</h2></div></div><div className="logic-badge"><LayersIcon size={16} />真实日线评分 · 非随机推荐</div></div>
          <div className="method-strip"><span>评分模型</span><p>趋势 24%</p><i /><p>量能 18%</p><i /><p>均线 18%</p><i /><p>相对强弱 16%</p><i /><p>板块热度 14%</p><i /><p>风险控制 10%</p></div>
          <div className="filter-bar">
            <label className="search-box"><SearchIcon size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索股票名称或代码" aria-label="搜索股票" /></label>
            <label className="select-wrap"><FilterIcon size={16} /><select value={industry} onChange={(event) => setIndustry(event.target.value)} aria-label="行业筛选">{industries.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="select-wrap"><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="排序方式"><option value="score-desc">评分：从高到低</option><option value="score-asc">评分：从低到高</option><option value="change-desc">涨幅：从高到低</option></select></label>
            <div className="risk-filter" aria-label="风险筛选">{(["全部", "低", "中", "高"] as const).map((item) => <button key={item} onClick={() => setRisk(item)} className={risk === item ? "active" : ""}>{item === "全部" ? "全部风险" : `${item}风险`}</button>)}</div>
          </div>
          <div className="result-line"><span>配置池 {snapshot.poolSize} 只，评分达标 <b>{filteredStocks.length}</b> 只</span><small>入池阈值：综合评分 ≥ 68</small></div>
          {filteredStocks.length ? <div className="stock-grid">{filteredStocks.map((stock, index) => <CandidateCard key={`${stock.code}.${stock.exchange}`} stock={stock} rank={index + 1} priceLabel={snapshot.source === "tencent" ? "最新延时价格" : "最新可用收盘价"} />)}</div> : <div className="empty-state"><SearchIcon size={28} /><h3>当前没有匹配的候选标的</h3><p>可能没有股票达到68分，或当前筛选条件过窄。</p></div>}
        </section>
      </div>
      <Footer snapshot={snapshot} />
    </main>
  );
}
