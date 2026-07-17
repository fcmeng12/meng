# 见山 A 股雷达

面向电脑和手机的中文 A 股行情研究网站。保留盘前、盘中和盘后三个分析页面，行情由 Next.js 服务端通过 Tushare Pro 获取，Token 不会进入浏览器代码或前端请求。

> 本网站内容仅用于行情研究和信息展示，不构成任何投资建议。

## 数据类型与边界

- 数据源：Tushare Pro。
- 当前接入接口：`daily`、`index_daily`、`stock_basic`。
- 当前展示的是 **最近可用收盘数据**，不是逐秒实时行情。
- Tushare 日线通常在交易日收盘后入库；盘中页面同样明确展示最近可用收盘快照。
- Token 缺失、权限不足或接口异常时，页面显示“行情暂时不可用”，不会自动回退为未标注的模拟数据。

## 已接入数据

- 上证指数、深证成指、创业板指
- 股票最新可用收盘价、当日涨跌幅、成交量、成交额
- 最近至少 60 个交易日 K 线
- 5 日、10 日、20 日均线
- 近 20 日最高价和最低价
- 全市场上涨、下跌、平盘家数及两市成交额
- 基于配置股票池计算的行业热度与动态候选池

## 六因子评分

候选股票由真实日线计算，综合评分不低于 68 才会进入候选池，不使用随机数。

| 因子 | 权重 | 主要输入 |
| --- | ---: | --- |
| 趋势强度 | 24% | 20 日收益、价格相对 MA20、20 日区间位置、均线差 |
| 量能变化 | 18% | 最新成交量相对前 20 日均量 |
| 均线状态 | 18% | 收盘价、MA5、MA10、MA20 多头关系与 MA20 方向 |
| 相对强弱 | 16% | 个股 20 日收益相对上证指数 |
| 板块热度 | 14% | 股票池行业平均涨跌、20 日收益与上涨占比 |
| 风险控制 | 10% | 20 日年化波动率与 60 日最大回撤 |

## 项目结构

```text
app/
├─ analysis/[session]/page.tsx  # 盘前、盘中、盘后三个页面
├─ api/market/route.ts          # 统一行情快照 API
├─ api/market/status/route.ts   # Token 与行情连接状态
├─ globals.css
└─ page.tsx
components/
├─ dashboard.tsx                # 现有设计、筛选、候选卡片与失败态
├─ icons.tsx
└─ sparkline.tsx
lib/market-data/
├─ actions.ts                   # 页面调用的 Server Action 边界
├─ cached-source.ts             # Next.js 数据缓存边界
├─ config.ts                    # 指数与股票池配置
├─ index.ts                     # 统一出口
├─ scoring.ts                   # 六因子计算
├─ service.ts                   # 行情聚合、行业热度与状态构建
├─ tushare-client.ts            # 仅服务端使用的 Tushare HTTP 客户端
└─ types.ts
```

## 环境变量

复制 `.env.example` 为 `.env.local`：

```env
TUSHARE_TOKEN=
```

可选自定义股票池，代码使用 Tushare 格式并以英文逗号分隔，最多 45 只：

```env
A_SHARE_STOCK_POOL=600036.SH,000001.SZ,300750.SZ
```

`TUSHARE_TOKEN` 只能配置在服务端，不要添加 `NEXT_PUBLIC_` 前缀，不要写进源码或提交到 Git。

## 缓存策略

- 指数和最新全市场日线：180 秒（3 分钟）
- 股票池历史日线和股票基础信息：1800 秒（30 分钟）
- Tushare HTTP POST 本身使用 `no-store`，由服务端 `unstable_cache` 统一控制缓存

这避免用户每次打开页面都直接重复调用上游接口。Vercel Serverless 实例之间由 Next.js Data Cache 管理缓存。

## API

行情快照：

```text
GET /api/market?session=premarket
GET /api/market?session=intraday
GET /api/market?session=afterhours
```

连接状态：

```text
GET /api/market/status
```

状态接口只返回 Token 是否已配置，不会返回 Token 内容。字段包括：

- `tokenConfigured`
- `connected`
- `lastSuccessAt`
- `isRealData`
- `source`
- `dataMode`
- `message`

## 本地运行与构建

```bash
pnpm install
pnpm dev
pnpm build
```

## Vercel 部署

1. 在 Vercel 项目中打开 **Settings → Environment Variables**。
2. 新增 `TUSHARE_TOKEN`，Environment 选择 **Production**；如需预览环境也可同时选择 Preview。
3. 如需自定义股票池，再新增 `A_SHARE_STOCK_POOL`。
4. 触发一次生产部署：

   ```bash
   pnpm dlx vercel@latest --prod --yes
   ```

5. 部署后访问 `/api/market/status`，确认 `connected` 和 `isRealData` 均为 `true`。

Tushare 不同接口可能需要相应积分或权限。当前版本至少需要 `daily`、`index_daily` 和 `stock_basic` 可用；权限不足时网站会显示连接失败，不会伪造行情。
