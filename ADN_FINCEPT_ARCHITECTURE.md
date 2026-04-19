# ADN Capital x Fincept Pattern — Kiến trúc triển khai cho chứng khoán Việt Nam

> Status: Superseded as canonical architecture baseline.  
> Canonical file: [docs/architecture/ADN_MASTER_ARCHITECTURE.md](docs/architecture/ADN_MASTER_ARCHITECTURE.md).  
> Keep this document for historical blueprint context only.

> Tài liệu này là **implementation blueprint** để Codex/Copilot hiểu đúng ý đồ kỹ thuật khi nâng cấp `adn-capital`.
> Mục tiêu là **mượn pattern kiến trúc từ FinceptTerminal** nhưng **giữ nguyên stack hiện tại của ADN**: Next.js + TypeScript + Prisma + Python FastAPI bridge + Docker Compose.
> Đây **không** phải tài liệu để rewrite app sang Qt/C++ và **không** phải hướng dẫn copy code từ Fincept.

---

## 1. Quyết định kiến trúc cốt lõi

### 1.1. Giữ nguyên stack hiện tại
- Frontend và BFF vẫn là **Next.js 15 + TypeScript**.
- DB vẫn là **PostgreSQL + Prisma**.
- Analytics, scan, backtest, market data normalization vẫn đi qua **Python bridge** (`fiinquant-bridge`).
- Deploy vẫn bám theo **Docker Compose** hiện tại (`db`, `pgbouncer`, `web`, `fiinquant`, `nginx`).

### 1.2. Chỉ mượn pattern, không copy implementation
Áp dụng từ Fincept các ý tưởng sau:
1. **DataHub + Topic Registry**
2. **Python-first provider architecture cho scanner/backtest**
3. **Research Workbench theo từng ticker**
4. **Broker/portfolio stream theo topic, DNSE-first**
5. **Workflow automation sau khi core data layer ổn định**

### 1.3. AI là nguyên tắc xuyên suốt, không phải lõi sinh tín hiệu
- **LLM không được sinh tín hiệu giao dịch gốc**.
- Scanner, signal engine, seasonality, exit scan, lifecycle là **rule-based / deterministic**.
- AI chỉ làm 4 việc:
  - giải thích dữ liệu,
  - tóm tắt,
  - cá nhân hóa theo portfolio/signal context,
  - viết insight/briefing/notification.
- AI **không được trả final widget JSON**. JSON shape phải do TypeScript/Python assemble.
- Mọi AI response phải có cache DB trước khi tái sử dụng.

### 1.4. Lưu ý license
- Không copy code từ FinceptTerminal sang ADN.
- Chỉ học **pattern kiến trúc** và tự triển khai lại trên codebase ADN.
- Nếu tham khảo implementation cụ thể từ Fincept, phải review license thật kỹ trước khi tái sử dụng bất kỳ đoạn code nào.

---

## 2. Hiện trạng ADN Capital cần bám theo

## 2.1. Những thứ đã có
Dựa trên repo hiện tại, ADN đã có nền tảng rất tốt để nâng cấp theo pattern này:
- `src/app/{dashboard,portfolio,rs-rating,signal-map,stock/[ticker],terminal,backtest}`
- `src/app/api/bridge/[[...path]]/route.ts` đang proxy request từ web sang `http://fiinquant:8000`
- `src/lib/fiinquantClient.ts` đã bọc typed wrappers cho nhiều endpoint market/TA/news/realtime/investor-trading
- `src/lib/PriceCache.ts` đã có tư duy “1 batch request + TTL + shared cache”
- `src/lib/UltimateSignalEngine.ts` đã có signal pipeline + seasonality cache + AI reasoning only on selected states
- `src/lib/SignalLifecycleWorker.ts` đã có lifecycle quản lý `RADAR / ACTIVE / HOLD_TO_DIE / CLOSED`
- `src/lib/dnseClient.ts` đã có khởi đầu cho DNSE integration
- Prisma schema đã có:
  - `Signal`
  - `Notification`
  - `MarketReport`
  - `CronLog`
  - `AiTaCache`
  - `AiFaCache`
  - `AiTamlyCache`
  - `AiInsightCache`
  - `SystemSetting`
  - nhiều bảng user/entitlement/journal đi kèm

## 2.2. Những gì cần sửa về mặt kiến trúc
Hiện ADN vẫn còn các vấn đề phổ biến của app dữ liệu thị trường:
- mỗi page hoặc mỗi widget tự gọi API riêng,
- cache nằm rải rác theo từng module,
- chưa có **topic contract** dùng chung giữa dashboard / terminal / stock page / portfolio / signal-map,
- Python bridge đã mạnh nhưng chưa có **provider registry chuẩn hóa**,
- stock page hiện còn thiên về chat hơn là **research workspace**,
- broker integration mới là khởi đầu, chưa có **account topic stream** thống nhất,
- workflow automation chưa có runtime riêng.

---

## 3. Mục tiêu đích đến

### 3.1. Mục tiêu kỹ thuật
Xây ADN thành một **web terminal cho chứng khoán Việt Nam** với 5 trụ cột:

1. **DataHub**
   - 1 nguồn sự thật cho state dữ liệu thị trường/nghiên cứu/tín hiệu/broker
   - giảm duplicate fetch giữa các page/widget
   - quản lý TTL, min interval, invalidation tập trung

2. **Python-first Engine**
   - scanner/backtest/indicator/strategy nằm ở Python
   - frontend chỉ load manifest, chạy config, render kết quả
   - không hardcode danh sách strategy trên UI

3. **Research Workbench**
   - mỗi mã cổ phiếu có workspace chuẩn:
     - giá/chart,
     - TA,
     - FA,
     - tâm lý & dòng tiền,
     - news,
     - seasonality,
     - signal context,
     - portfolio context

4. **Broker/Portfolio Stream**
   - DNSE là broker đầu tiên
   - chuẩn hóa positions/orders/balance/portfolio vào DataHub topics
   - dùng chung giữa portfolio page, alert engine, AI, notification

5. **Workflow Automation**
   - trigger theo cron / market event / signal event / broker event
   - action theo notify / refresh topic / run scan / update DB / backtest
   - bắt đầu bằng JSON workflow, chưa cần visual node editor ngay

### 3.2. Mục tiêu sản phẩm
- nhanh hơn khi chuyển page vì dữ liệu được shared,
- nhất quán giữa dashboard / stock / terminal / portfolio,
- giảm request FiinQuant không cần thiết,
- tăng khả năng mở rộng cho scanner/backtest,
- dễ cho Codex/Copilot tiếp tục code mà không phá vỡ thiết kế.

---

## 4. Nguyên tắc bắt buộc cho Codex

## 4.1. Không được làm
- Không rewrite sang Qt/C++.
- Không copy code từ FinceptTerminal.
- Không đưa Redis/Kafka/MQTT vào giai đoạn đầu.
- Không cho LLM quyền quyết định BUY/SELL gốc.
- Không tạo thêm 37 AI agent/persona.
- Không hardcode strategy list ở frontend nếu Python có thể trả manifest.
- Không tạo mỗi widget một API loop riêng nếu topic đã có.

## 4.2. Bắt buộc phải làm
- Ưu tiên thay đổi **nhỏ, có thể deploy từng phase**.
- Reuse các module hiện có như:
  - `fiinquantClient.ts`
  - `PriceCache.ts`
  - `UltimateSignalEngine.ts`
  - `SignalLifecycleWorker.ts`
  - `dnseClient.ts`
- Nếu cần schema mới, thêm qua Prisma migration rõ ràng.
- Toàn bộ data flow mới phải có:
  - owner rõ ràng,
  - cache policy rõ ràng,
  - invalidation rõ ràng,
  - logging rõ ràng.

---

# 5. Trụ cột số 1 — DataHub + Topic Registry

## 5.1. Mục tiêu
DataHub là lớp điều phối dữ liệu trung tâm cho ADN.

Trong bối cảnh Next.js Docker một `web` container, DataHub có thể là **singleton in-memory trong Node runtime**. Không cần broker ngoài tiến trình ở giai đoạn đầu.

DataHub phải giải quyết:
- một topic chỉ fetch một lần tại một thời điểm,
- nhiều subscriber dùng chung cùng kết quả,
- có TTL + min interval + stale/fresh semantics,
- hỗ trợ:
  - pull topics (HTTP/cache)
  - push topics (SSE/WebSocket nội bộ sau)
  - manual invalidation.

## 5.2. Kiến trúc logic
```text
UI Components / Hooks
        ↓
   useTopic() / useTopics()
        ↓
   DataHub Client Adapter
        ↓
   /api/hub/topic/...  hoặc SSE subscribe
        ↓
      DataHub Core
   - registry
   - cache
   - in-flight dedupe
   - stale/fresh state
   - publish/invalidate
        ↓
      Producers
   - market producer
   - research producer
   - signal producer
   - broker producer
   - news producer
        ↓
Sources
- fiinquant bridge
- prisma
- dnse
- internal cron outputs
```

## 5.3. File structure cần tạo
```text
src/
  lib/
    datahub/
      types.ts
      topic.ts
      registry.ts
      cache.ts
      hub.ts
      utils.ts
      market-hours.ts
      producers/
        base.ts
        marketProducer.ts
        researchProducer.ts
        signalProducer.ts
        brokerProducer.ts
        newsProducer.ts
        portfolioProducer.ts
  hooks/
    useTopic.ts
    useTopics.ts
    useTopicInvalidate.ts
  app/
    api/
      hub/
        topic/[...topic]/route.ts
        subscribe/route.ts          # phase 2, SSE
        invalidate/route.ts         # internal only
```

## 5.4. Core types đề xuất
```ts
export type TopicKey = string;

export type TopicFreshness = "fresh" | "stale" | "expired" | "missing";

export interface TopicPolicy {
  ttlMs: number;
  minIntervalMs: number;
  staleWhileRevalidateMs?: number;
  pushOnly?: boolean;
  owner: string;
}

export interface TopicEnvelope<T = unknown> {
  topic: TopicKey;
  value: T;
  updatedAt: number;
  expiresAt: number;
  freshness: TopicFreshness;
  source: string;
  version: number;
}

export interface TopicFetchContext {
  topic: TopicKey;
  now: number;
  force?: boolean;
  params?: Record<string, string | number | boolean>;
}

export interface TopicProducer {
  name: string;
  match(topic: TopicKey): boolean;
  fetch(ctx: TopicFetchContext): Promise<unknown>;
}
```

## 5.5. Topic naming rules
- lowercase
- colon-delimited
- không có space
- key phải ổn định
- pattern rõ domain
- wildcard chỉ dùng cho subscription/query nội bộ, không dùng cho persistence key

Format khuyến nghị:
```text
vn:<domain>:<entity>[:<modifier>...]
signal:<scope>:<entity>[:<modifier>...]
portfolio:user:<userId>:<entity>
broker:dnse:<accountId>:<channel>
news:<scope>[:<ticker>|:<date>]
workflow:<name>:<state>
```

## 5.6. Topic registry chuẩn cho ADN Việt Nam
> Đây là canonical registry đầu tiên. Có thể mở rộng nhưng không được đổi tên tùy tiện sau khi public.

### 5.6.1. Market & index topics
| Topic pattern | Owner | TTL | Min interval | Source |
|---|---|---:|---:|---|
| `vn:index:snapshot` | `marketProducer` | 10s | 5s | `GET /api/v1/market-snapshot` |
| `vn:index:overview` | `marketProducer` | 60s | 30s | `GET /api/v1/market-overview` |
| `vn:index:breadth:<index>` | `marketProducer` | 15s | 10s | `GET /api/v1/market-breadth` |
| `vn:index:valuation:<index>` | `marketProducer` | 6h | 30m | `GET /api/v1/index-valuation` |
| `vn:index:rpi:vn30` | `marketProducer` | 60s | 30s | `GET /api/v1/rpi` |
| `vn:index:leader-radar` | `signalProducer` | 60s | 30s | `GET /api/v1/leader-radar` |

### 5.6.2. Ticker market data topics
| Topic pattern | Owner | TTL | Min interval | Source |
|---|---|---:|---:|---|
| `vn:quote:<ticker>` | `marketProducer` | 15s | 5s | batch price / realtime |
| `vn:intraday:<ticker>:5m` | `marketProducer` | 15s | 10s | `GET /api/v1/realtime/{ticker}?timeframe=5m` |
| `vn:intraday:<ticker>:1m` | `marketProducer` | 15s | 10s | same endpoint if available |
| `vn:history:<ticker>:730d:1d` | `marketProducer` | 6h | 10m | `GET /api/v1/historical/{ticker}` |
| `vn:ta:<ticker>` | `researchProducer` | 5m | 60s | `GET /api/v1/ta-summary/{ticker}` |
| `vn:fa:<ticker>` | `researchProducer` | 24h | 6h | `GET /api/v1/fundamental/{ticker}` |
| `vn:seasonality:<ticker>` | `researchProducer` | 24h | 6h | `GET /api/v1/seasonality/{ticker}` |
| `vn:flows:<ticker>` | `researchProducer` | 15m | 5m | `GET /api/v1/investor-trading?tickers=` |

### 5.6.3. Research/AI topics
| Topic pattern | Owner | TTL | Min interval | Source |
|---|---|---:|---:|---|
| `research:ta-ai:<ticker>` | `researchProducer` | 5m | 60s | DB cache + AI fallback |
| `research:fa-ai:<ticker>` | `researchProducer` | 24h | 6h | DB cache + AI fallback |
| `research:tamly-ai:<ticker>` | `researchProducer` | 24h | 6h | DB cache + AI fallback |
| `research:news-ai:<ticker>` | `newsProducer` | 30m | 10m | news summarization |
| `research:workbench:<ticker>` | `researchProducer` | 60s | 15s | aggregate topic |

### 5.6.4. Signal topics
| Topic pattern | Owner | TTL | Min interval | Source |
|---|---|---:|---:|---|
| `signal:scan:latest` | `signalProducer` | 5m | 60s | scanner output |
| `signal:radar` | `signalProducer` | 30s | 15s | Prisma `Signal` |
| `signal:active` | `signalProducer` | 30s | 15s | Prisma `Signal` |
| `signal:ticker:<ticker>` | `signalProducer` | 30s | 15s | Prisma `Signal` |
| `signal:lifecycle:stats` | `signalProducer` | 30s | 15s | lifecycle worker summary |

### 5.6.5. Portfolio & broker topics
| Topic pattern | Owner | TTL | Min interval | Source |
|---|---|---:|---:|---|
| `portfolio:user:<userId>:summary` | `portfolioProducer` | 15s | 10s | Prisma + broker snapshot |
| `portfolio:user:<userId>:positions` | `portfolioProducer` | 15s | 10s | Prisma/broker |
| `portfolio:user:<userId>:watchlist` | `portfolioProducer` | 60s | 30s | Prisma |
| `broker:dnse:<accountId>:balance` | `brokerProducer` | 15s | 10s | DNSE |
| `broker:dnse:<accountId>:positions` | `brokerProducer` | 15s | 10s | DNSE |
| `broker:dnse:<accountId>:orders` | `brokerProducer` | 10s | 5s | DNSE |
| `broker:dnse:<accountId>:fills` | `brokerProducer` | 10s | 5s | DNSE |
| `broker:dnse:market:snapshot` | `brokerProducer` | 60s | 30s | current `dnseClient.ts` |

### 5.6.6. News & notification topics
| Topic pattern | Owner | TTL | Min interval | Source |
|---|---|---:|---:|---|
| `news:morning:latest` | `newsProducer` | 30m | 10m | `GET /api/v1/news/morning` |
| `news:eod:latest` | `newsProducer` | 30m | 10m | `GET /api/v1/news/eod` |
| `news:ticker:<ticker>` | `newsProducer` | 15m | 5m | ticker news aggregation |
| `notification:user:<userId>` | `newsProducer` | 30s | 15s | Prisma `Notification` |

## 5.7. DataHub API tối thiểu
### 5.7.1. Read single topic
```http
GET /api/hub/topic/vn:index:overview
```

Response:
```json
{
  "topic": "vn:index:overview",
  "value": { "...": "..." },
  "updatedAt": 1760000000000,
  "expiresAt": 1760000060000,
  "freshness": "fresh",
  "source": "marketProducer",
  "version": 1
}
```

### 5.7.2. Batch topics
```http
POST /api/hub/topic/batch
```

Body:
```json
{
  "topics": [
    "vn:index:snapshot",
    "vn:index:overview",
    "signal:active"
  ]
}
```

### 5.7.3. Invalidate topic
```http
POST /api/hub/invalidate
```

Body:
```json
{
  "topics": ["signal:active", "signal:ticker:HPG"]
}
```

### 5.7.4. SSE subscribe (phase 2)
```http
GET /api/hub/subscribe?topics=vn:index:snapshot,signal:active
```

## 5.8. Hook API cho frontend
```ts
const { data, freshness, mutate } = useTopic<TopicValue>("vn:ta:HPG");

const batch = useTopics([
  `vn:quote:${ticker}`,
  `vn:ta:${ticker}`,
  `vn:fa:${ticker}`,
  `signal:ticker:${ticker}`,
  `portfolio:user:${userId}:positions`,
]);
```

## 5.9. Producer responsibilities
- `marketProducer`
  - market snapshot, breadth, quote, history, realtime
- `researchProducer`
  - ta, fa, seasonality, ai insight, workbench aggregate
- `signalProducer`
  - latest scan, radar/active signals, ticker signal state
- `portfolioProducer`
  - user portfolio summary, watchlist, merged positions
- `brokerProducer`
  - dnse balance/orders/positions
- `newsProducer`
  - morning/eod/ticker news + notifications

## 5.10. Invalidation rules
- Sau `scan-now` thành công:
  - invalidate `signal:*`
  - invalidate `vn:index:leader-radar`
- Sau lifecycle worker chạy:
  - invalidate `signal:*`
  - invalidate `portfolio:user:*:summary`
- Sau user cập nhật portfolio/journal:
  - invalidate `portfolio:user:<id>:*`
  - invalidate `research:workbench:<ticker>` nếu liên quan
- Sau cron morning/eod:
  - invalidate `news:*`
  - invalidate `notification:user:*`

## 5.11. Những page phải migrate đầu tiên
### Phase A
1. `dashboard`
2. `stock/[ticker]`
3. `portfolio`

### Phase B
4. `signal-map`
5. `terminal`
6. `rs-rating`

---

# 6. Trụ cột số 2 — Python-first Provider Architecture cho Scanner / Backtest

## 6.1. Mục tiêu
Bridge Python phải là nơi:
- định nghĩa strategy,
- định nghĩa indicator,
- chạy scan,
- chạy backtest,
- trả manifest động cho UI.

Frontend không nên hardcode danh sách strategy/indicator dài hạn.

## 6.2. Quy tắc
- Python là **single source of truth** cho provider config.
- Frontend chỉ render theo manifest.
- Scanner rule-based **không gọi LLM**.
- AI chỉ nhận output normalized từ scanner để viết explanation nếu cần.

## 6.3. Target structure cho `fiinquant-bridge`
> Không bắt buộc phải rename toàn bộ file hiện có ngay. Có thể tách dần nhưng `main.py` phải mỏng dần.

```text
fiinquant-bridge/
  main.py
  providers/
    __init__.py
    registry.py
    scanner/
      __init__.py
      base.py
      adn_scanner_provider.py
      breakout_provider.py
      rs_leader_provider.py
    backtest/
      __init__.py
      base.py
      vectorbt_provider.py
      backtestingpy_provider.py
      fincept_style_provider.py
    research/
      __init__.py
      ta_provider.py
      fa_provider.py
      tamly_provider.py
      news_provider.py
    broker/
      __init__.py
      dnse_provider.py
  services/
    market_data.py
    historical_data.py
    indicator_engine.py
    signal_engine.py
    seasonality_service.py
    lifecycle_service.py
    ai_insight_service.py
  schemas/
    backtest.py
    scanner.py
    research.py
    broker.py
```

## 6.4. Provider contracts
### 6.4.1. Scanner provider
```python
class ScannerProvider(Protocol):
    id: str
    name: str

    def get_manifest(self) -> dict: ...
    def run_scan(self, universe: list[str], config: dict) -> dict: ...
```

### 6.4.2. Backtest provider
```python
class BacktestProvider(Protocol):
    id: str
    name: str

    def get_manifest(self) -> dict: ...
    def run_backtest(self, config: dict) -> dict: ...
    def list_strategies(self) -> list[dict]: ...
    def list_indicators(self) -> list[dict]: ...
```

## 6.5. API contract cần có
### 6.5.1. Backtest manifest
```http
GET /api/v1/backtest/providers
GET /api/v1/backtest/strategies?provider=vectorbt
GET /api/v1/backtest/indicators?provider=vectorbt
```

### 6.5.2. Run backtest
```http
POST /api/v1/backtest/run
```

Body:
```json
{
  "provider": "vectorbt",
  "ticker": "HPG",
  "timeframe": "1d",
  "range": { "from": "2022-01-01", "to": "2026-01-01" },
  "strategy": {
    "id": "ema_cross",
    "params": {
      "fast": 10,
      "slow": 30
    }
  },
  "risk": {
    "positionSizePct": 10,
    "stopLossPct": 7,
    "takeProfitPct": 20
  }
}
```

### 6.5.3. Run scan
```http
POST /api/v1/scan/provider/run
```

Body:
```json
{
  "provider": "adn_scanner",
  "universe": "hose_all",
  "config": {
    "enableLeader": true,
    "enableMidterm": true,
    "enableShortTerm": true
  }
}
```

## 6.6. Manifest shape để UI render động
```json
{
  "provider": "vectorbt",
  "label": "VectorBT",
  "strategies": [
    {
      "id": "ema_cross",
      "name": "EMA Cross",
      "category": "trend",
      "params": [
        { "name": "fast", "type": "int", "default": 10, "min": 2, "max": 100 },
        { "name": "slow", "type": "int", "default": 30, "min": 5, "max": 300 }
      ]
    }
  ],
  "indicators": [
    {
      "id": "rsi",
      "name": "RSI",
      "params": [{ "name": "length", "type": "int", "default": 14 }]
    }
  ]
}
```

## 6.7. Strategy families hợp lý cho chứng khoán Việt Nam
### Scanner families
- RS leader breakout
- VCP / contraction breakout
- Double bottom + volume confirmation
- EMA 10/30 trend continuation
- Bullish divergence + MACD reclaim
- Liquidity filter theo HOSE/HNX/UPCOM
- Foreign flow accumulation filter
- Self-trading / breadth regime filter

### Backtest families
- EMA trend following
- Breakout + volatility contraction
- Relative strength ranking rotation
- Market regime filter theo VNINDEX composite score
- Risk-first ADN allocation model
- Staircase trailing stop tương thích lifecycle hiện tại

## 6.8. Quan hệ với code hiện có
- `scanner.py` v4 hiện tại vẫn là nền tảng chính.
- `UltimateSignalEngine.ts` vẫn dùng được, nhưng nên chuyển dần logic nặng sang Python nếu:
  - cần đồng bộ với backtest,
  - cần cùng 1 rule set cho scan và simulate,
  - cần tái sử dụng từ workflow engine.

### Quyết định đề xuất
- Giữ `UltimateSignalEngine.ts` cho orchestration ngắn hạn.
- Chuyển rule definitions dần sang Python manifest để tránh drift.
- `SignalLifecycleWorker.ts` có thể vẫn ở TS trước, sau này chuyển bớt calculation nặng sang Python endpoint nếu cần.

## 6.9. Definition of done cho trụ cột 2
- UI không hardcode strategy list chính.
- Có ít nhất 1 backtest provider chạy end-to-end.
- Có manifest endpoint hoạt động.
- Scanner không gọi LLM.
- Output backtest/scanner có schema ổn định.
- Có log, timeout, error envelope rõ ràng.

---

# 7. Trụ cột số 3 — Research Workbench theo từng ticker

## 7.1. Mục tiêu
Biến `src/app/stock/[ticker]` từ trang thiên về chat thành **research workspace** thực thụ cho từng mã cổ phiếu Việt Nam.

Trang này phải là nơi hội tụ:
- giá và chart,
- TA,
- FA,
- tâm lý/dòng tiền,
- news,
- seasonality,
- signal lifecycle,
- portfolio context,
- action summary.

## 7.2. Cấu trúc UI đề xuất
```text
Stock Workbench
├─ Header
│  ├─ ticker / company / sector
│  ├─ price / change / liquidity
│  ├─ signal badge / market regime badge
│  └─ actions: add watchlist / run backtest / open terminal chat
├─ Hero zone
│  ├─ main chart
│  └─ quick insight card
├─ Tab group
│  ├─ Tổng quan
│  ├─ TA
│  ├─ FA
│  ├─ Tâm lý & Dòng tiền
│  ├─ News
│  ├─ Seasonality
│  ├─ Signal
│  └─ Portfolio
└─ Bottom rail
   ├─ related tickers
   ├─ sector leaders
   └─ activity log
```

## 7.3. Component structure đề xuất
```text
src/components/workbench/
  WorkbenchShell.tsx
  WorkbenchHeader.tsx
  WorkbenchQuickInsight.tsx
  WorkbenchTabs.tsx
  tabs/
    OverviewTab.tsx
    TechnicalTab.tsx
    FundamentalTab.tsx
    SentimentTab.tsx
    NewsTab.tsx
    SeasonalityTab.tsx
    SignalTab.tsx
    PortfolioTab.tsx
  cards/
    PriceHeaderCard.tsx
    SignalSummaryCard.tsx
    ForeignFlowCard.tsx
    SelfTradingCard.tsx
    SupportResistanceCard.tsx
    RiskScenarioCard.tsx
```

## 7.4. Data contract cho workbench
### Aggregate topic
`research:workbench:<ticker>`

Shape đề xuất:
```json
{
  "ticker": "HPG",
  "market": {
    "quote": {},
    "intraday": {},
    "history": {}
  },
  "research": {
    "ta": {},
    "fa": {},
    "tamly": {},
    "seasonality": {},
    "news": {}
  },
  "signal": {
    "latest": {},
    "lifecycle": {},
    "leaderRadar": {}
  },
  "portfolio": {
    "isHeld": true,
    "avgCost": 25.4,
    "quantity": 1200,
    "pnlPct": 8.2
  },
  "summary": {
    "stance": "THEO_DOI",
    "confidence": 0.71,
    "reasons": ["..."],
    "risks": ["..."]
  }
}
```

## 7.5. Tab rules
### Tổng quan
- load nhanh nhất,
- chỉ dùng aggregate topics đã warm cache,
- không block bởi FA/news.

### TA
- dùng `vn:ta:<ticker>` + `research:ta-ai:<ticker>`
- hiển thị:
  - xu hướng,
  - RSI/MACD/Stoch/MFI,
  - EMA stack,
  - support/resistance,
  - pattern detected,
  - AI insight.

### FA
- dùng `vn:fa:<ticker>` + `research:fa-ai:<ticker>`
- hiển thị:
  - valuation,
  - profitability,
  - leverage,
  - growth,
  - foreign room,
  - AI luận điểm.

### Tâm lý & Dòng tiền
- dùng:
  - `vn:intraday:<ticker>:5m`
  - `vn:flows:<ticker>`
  - `research:tamly-ai:<ticker>`
- hiển thị:
  - mua chủ động/bán chủ động,
  - foreign flow,
  - volume vs MA20,
  - ATC behavior,
  - crowd sentiment.

### News
- dùng `news:ticker:<ticker>`
- phân loại:
  - doanh nghiệp,
  - ngành,
  - vĩ mô ảnh hưởng,
  - catalyst/risk.

### Seasonality
- dùng `vn:seasonality:<ticker>`
- thêm thống kê:
  - current month win rate,
  - sharpe,
  - seasonal bias,
  - dùng để giải thích navAllocation logic.

### Signal
- dùng `signal:ticker:<ticker>`
- hiển thị:
  - status hiện tại,
  - entry / target / stop,
  - RR,
  - win rate,
  - trailing stop state,
  - lý do ACTIVE/CLOSED/HOLD_TO_DIE.

### Portfolio
- dùng `portfolio:user:<userId>:positions`
- chỉ render nếu authenticated.

## 7.6. Điều chỉnh route hiện có
### Route giữ lại
- `src/app/stock/[ticker]/page.tsx`

### Hành vi mới
- vẫn có AI chat contextual,
- nhưng chat chỉ là **panel phụ**,
- không phải nội dung chính của trang.

### Optional route mới
- `src/app/terminal/[ticker]/page.tsx`
  - nếu muốn tách “terminal chat contextual” ra khỏi stock workbench.

## 7.7. Ưu tiên migrate
1. Header + quote + chart
2. TA + FA tabs
3. sentiment/news tabs
4. signal/portfolio tabs
5. contextual chat rail

## 7.8. Definition of done cho trụ cột 3
- `stock/[ticker]` không còn chỉ là chat page.
- Có aggregate workbench topic.
- Dữ liệu TA/FA/Tâm lý/News được load theo topic, không gọi lẻ tẻ vô tổ chức.
- Có fallback skeleton theo từng tab.
- Không chờ FA 24h cache xong mới render toàn trang.

---

# 8. Trụ cột số 4 — Broker & Portfolio Stream, DNSE-first

## 8.1. Mục tiêu
Chuẩn hóa broker data thành topic contract để:
- portfolio page dùng chung,
- alert engine dùng chung,
- AI dùng chung,
- notification/workflow dùng chung.

## 8.2. Phạm vi giai đoạn đầu
DNSE là broker đầu tiên.
Không cố multi-broker ngay.

Bắt đầu với 4 channel:
1. balance
2. positions
3. orders
4. fills / executions

## 8.3. Topic shape chuẩn
```text
broker:dnse:<accountId>:balance
broker:dnse:<accountId>:positions
broker:dnse:<accountId>:orders
broker:dnse:<accountId>:fills
portfolio:user:<userId>:summary
portfolio:user:<userId>:positions
```

## 8.4. File structure đề xuất
```text
src/lib/broker/
  types.ts
  dnse/
    client.ts
    mapper.ts
    sync.ts
    topics.ts
  portfolio/
    aggregate.ts
    pnl.ts
    risk.ts
```

## 8.5. Prisma models đề xuất
> Chỉ thêm nếu cần persistence/snapshot/history. Nếu DNSE API chưa đủ mạnh, có thể làm read-through trước.

```prisma
model BrokerAccount {
  id          String   @id @default(cuid())
  userId      String
  broker      String   // DNSE
  accountCode String
  isPrimary   Boolean  @default(true)
  status      String   @default("ACTIVE")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([broker, accountCode])
  @@index([userId, broker])
}

model BrokerPositionSnapshot {
  id          String   @id @default(cuid())
  broker      String
  accountCode String
  ticker      String
  quantity    Float
  avgPrice    Float?
  marketPrice Float?
  marketValue Float?
  pnl         Float?
  pnlPct      Float?
  asOf        DateTime @default(now())

  @@index([broker, accountCode, asOf])
  @@index([ticker, asOf])
}

model BrokerOrderSnapshot {
  id          String   @id @default(cuid())
  broker      String
  accountCode String
  externalId  String
  ticker      String
  side        String
  quantity    Float
  filledQty   Float?
  price       Float?
  status      String
  asOf        DateTime @default(now())

  @@unique([broker, externalId])
  @@index([broker, accountCode, asOf])
}
```

## 8.6. Merge rule: broker positions vs internal portfolio
Portfolio view phải hỗ trợ 2 nguồn:
- **internal portfolio/journal** từ người dùng tự nhập,
- **broker positions** từ DNSE.

Quy tắc:
- Broker positions là “live holdings reality” nếu user đã connect broker.
- Internal portfolio vẫn giữ vai trò journal/phân tích/tâm lý.
- `portfolio:user:<userId>:summary` phải trả merged state:
  - holdings live,
  - avg cost nếu broker có,
  - AI/signal overlay,
  - journal tags nếu có.

## 8.7. Cảnh báo/risk dùng chung
Broker stream phải feed sang:
- `SignalLifecycleWorker`
- alert engine
- research workbench
- workflow engine

Ví dụ:
- user đang hold HPG và `signal:ticker:HPG` chuyển `CLOSED`
- workflow tạo notification riêng cho user
- workbench tab Portfolio hiển thị risk mismatch

## 8.8. Security
- DNSE token/secret tuyệt đối chỉ ở server-side.
- Không đẩy raw broker credential ra client.
- Route broker phải là authenticated internal API only.
- Topic data trả ra client phải sanitize.

## 8.9. Definition of done cho trụ cột 4
- Có topic cho balance/positions/orders.
- Portfolio page đọc topic thay vì fetch rời rạc.
- Có merge layer portfolio internal + broker.
- Có invalidation khi sync broker xong.
- Không lộ secret/token qua client.

---

# 9. Trụ cột số 5 — Workflow Automation (sau khi core data layer ổn định)

## 9.1. Mục tiêu
Tạo automation layer nhẹ, thực dụng, chưa cần visual node editor ngay.

Workflow engine cho ADN dùng để:
- tự động chạy scan,
- gửi Telegram/Notification,
- refresh topic,
- log kết quả,
- kích hoạt backtest/report theo trigger.

## 9.2. Chiến lược triển khai
### Giai đoạn 1
- workflow dạng JSON + runner server-side
- quản lý qua admin page đơn giản

### Giai đoạn 2
- thêm UI builder cơ bản
- vẫn chưa cần drag-drop phức tạp

### Giai đoạn 3
- nếu cần mới nghĩ tới visual graph editor

## 9.3. Workflow model đề xuất
```prisma
model AutomationWorkflow {
  id          String   @id @default(cuid())
  name        String
  enabled     Boolean  @default(true)
  triggerType String   // CRON | TOPIC_THRESHOLD | SIGNAL_EVENT | BROKER_EVENT
  triggerSpec Json
  actionSpec  Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model AutomationExecution {
  id          String   @id @default(cuid())
  workflowId  String
  status      String   // SUCCESS | FAILED | SKIPPED
  input       Json?
  output      Json?
  error       String?
  createdAt   DateTime @default(now())

  @@index([workflowId, createdAt])
}
```

## 9.4. Trigger types đầu tiên
- `CRON`
- `SIGNAL_STATUS_CHANGED`
- `TOPIC_REFRESHED`
- `TOPIC_THRESHOLD`
- `BROKER_ORDER_FILLED`
- `MARKET_REGIME_CHANGED`

## 9.5. Action types đầu tiên
- `RUN_SCAN`
- `RUN_BACKTEST`
- `REFRESH_TOPIC`
- `SEND_TELEGRAM`
- `CREATE_NOTIFICATION`
- `WRITE_MARKET_REPORT`
- `REBALANCE_NAV`
- `CALL_INTERNAL_API`

## 9.6. JSON workflow ví dụ
```json
{
  "name": "Alert khi signal ACTIVE trùng holdings",
  "triggerType": "SIGNAL_STATUS_CHANGED",
  "triggerSpec": {
    "from": ["RADAR"],
    "to": ["ACTIVE"]
  },
  "actionSpec": [
    {
      "type": "CREATE_NOTIFICATION",
      "params": {
        "target": "holders_of_same_ticker"
      }
    },
    {
      "type": "SEND_TELEGRAM",
      "params": {
        "channel": "signal_alert"
      }
    }
  ]
}
```

## 9.7. Liên kết với DataHub
Workflow runner phải subscribe hoặc react với:
- `signal:*`
- `broker:*`
- `vn:index:*`
- `news:*`

Nhưng workflow **không** thay DataHub.
DataHub là state layer.
Workflow là action layer.

## 9.8. Definition of done cho trụ cột 5
- Có 1 workflow runner hoạt động server-side.
- Có ít nhất 2 trigger + 2 action thật.
- Có execution log.
- Không chặn request user-facing.
- Có retry/error handling cơ bản.

---

# 10. AI Policy xuyên suốt

## 10.1. AI chỉ ở lớp explain/brief
Áp dụng toàn hệ thống:
- scanner: không gọi LLM
- lifecycle: không gọi LLM để quyết định close
- market overview scoring: deterministic trước, AI chỉ diễn giải
- widget JSON: assemble bằng code
- AI output chỉ là:
  - `analysis`
  - `aiReasoning`
  - `summary`
  - `bullet points`

## 10.2. Cache policy cho AI
- TA AI: 5 phút hoặc invalidate khi vỡ support/resistance
- FA AI: 24h hoặc invalidate khi có quarter mới
- Tâm lý AI: 1 ngày
- News AI: 30 phút
- Market brief AI: theo cron output

## 10.3. Personalization policy
AI có thể tham chiếu:
- user có đang hold ticker không,
- signal hiện tại là gì,
- user có entitlement gì,
- lịch sử journal nếu cần.

Nhưng:
- không leak logic cá nhân hóa ra UI,
- không để AI tự query bừa bãi ngoài context định sẵn,
- prompt phải lấy context từ code, không đoán.

---

# 11. Deployment / Runtime assumptions

## 11.1. Assumption giai đoạn đầu
- 1 `web` container
- 1 `fiinquant` container
- 1 PostgreSQL
- 1 pgbouncer

Vì đang single-node nên:
- in-memory DataHub singleton là chấp nhận được,
- không cần Redis ngay,
- nếu scale lên nhiều `web` replicas thì mới cân nhắc distributed cache/event bus.

## 11.2. Logging bắt buộc
Mỗi producer/workflow cần log:
- topic
- source
- latency
- cache hit/miss
- stale/fresh
- error summary

---

# 12. Lộ trình triển khai đề xuất

## Phase 1 — DataHub foundation
### Mục tiêu
- tạo `src/lib/datahub/*`
- migrate `dashboard` sang topic-based reads

### Done when
- dashboard dùng `useTopic/useTopics`
- `vn:index:snapshot`, `vn:index:overview`, `news:morning:latest`, `news:eod:latest` chạy ổn
- duplicate fetch giảm rõ rệt

---

## Phase 2 — Stock research workbench
### Mục tiêu
- nâng cấp `stock/[ticker]`
- có aggregate topic `research:workbench:<ticker>`

### Done when
- có tabs TA / FA / Tâm lý / News / Signal / Portfolio
- chat thành panel phụ
- dùng chung topic data với dashboard/portfolio

---

## Phase 3 — Python-first backtest/scanner manifests
### Mục tiêu
- thêm provider registry trong Python
- UI backtest load manifest động

### Done when
- ít nhất 1 provider backtest end-to-end
- scanner manifest hoặc run config chuẩn hóa
- frontend không hardcode strategy list chính

---

## Phase 4 — DNSE-first broker topics
### Mục tiêu
- chuẩn hóa positions/orders/balance vào DataHub
- merge vào portfolio

### Done when
- portfolio page đọc merged topic
- workbench thấy broker context
- signal alerts có thể tham chiếu holdings live

---

## Phase 5 — Workflow automation
### Mục tiêu
- có workflow runner JSON
- tích hợp với signal/broker/news

### Done when
- ít nhất 2 workflow thật chạy thành công
- có logs + retry + admin control cơ bản

---

# 13. Checklist code review cho Codex

## 13.1. Mỗi PR phải trả lời được
- topic mới này owner là ai?
- TTL là bao lâu?
- invalidation lúc nào?
- data source nào là authoritative?
- có duplicate fetch không?
- logic này nên ở TS hay Python?
- có để LLM quyết định thay rule engine không?
- cache có thể stale bao lâu?
- UI có bị block bởi endpoint chậm không?

## 13.2. Nếu thêm endpoint mới
- định nghĩa schema request/response rõ
- timeout rõ
- error envelope rõ
- có auth nếu cần
- có logging

## 13.3. Nếu thêm AI flow mới
- data thật phải lấy xong trước
- assemble JSON bằng code
- cache DB trước khi tái dùng
- có fallback model
- không để AI trả “chưa có dữ liệu” phá UI

---

# 14. Non-goals rõ ràng

Những thứ **không làm ngay**:
- rewrite desktop native
- global intelligence / geopolitics / maritime
- multi-broker toàn diện
- drag-drop node editor phức tạp
- multi-process message bus
- LLM-generated strategy execution
- HFT / RL / ML lab

---

# 15. Kết luận kỹ thuật

Kiến trúc đúng cho ADN không phải là “bê FinceptTerminal vào web app”, mà là:

1. **Web terminal vẫn là ADN chính**
2. **DataHub là xương sống**
3. **Python bridge là engine analytics/backtest/scanner**
4. **Research Workbench là trải nghiệm trung tâm**
5. **Broker topics + workflow là lớp mở rộng sau cùng**

Nói ngắn gọn:

- **Giữ ADN là web-first cho chứng khoán Việt Nam**
- **Mượn Fincept ở phần kiến trúc dữ liệu và orchestration**
- **Không mượn Fincept ở phần desktop/runtime/phức tạp toàn cầu**

---

# 16. Nhiệm vụ triển khai đầu tiên cho Codex

## Task 1
Tạo DataHub core:
- `src/lib/datahub/types.ts`
- `src/lib/datahub/registry.ts`
- `src/lib/datahub/hub.ts`
- `src/hooks/useTopic.ts`
- `src/app/api/hub/topic/[...topic]/route.ts`

## Task 2
Tạo registry cho 10 topic đầu tiên:
- `vn:index:snapshot`
- `vn:index:overview`
- `vn:index:breadth:VNINDEX`
- `news:morning:latest`
- `news:eod:latest`
- `signal:active`
- `signal:radar`
- `vn:ta:<ticker>`
- `vn:fa:<ticker>`
- `research:workbench:<ticker>`

## Task 3
Migrate `dashboard/page.tsx` sang `useTopic/useTopics`

## Task 4
Refactor `stock/[ticker]/page.tsx` thành Workbench shell

## Task 5
Tách Python bridge dần sang provider-based structure nhưng vẫn giữ `main.py` là public entrypoint cũ

---

# 17. Ghi chú cuối cho Codex

Khi code theo tài liệu này, hãy ưu tiên:
- thay đổi nhỏ,
- chạy được từng bước,
- không phá deploy hiện tại,
- không đổi public contract vô cớ,
- không biến hệ thống thành “AI app” thiếu deterministic core.

ADN phải là:
- **deterministic ở lớp signal/risk**
- **intelligent ở lớp explanation/orchestration**
- **tối ưu cho chứng khoán Việt Nam**
- **mở rộng dần theo phase**

---

# 18. File tham chiếu bắt buộc trong repo ADN

Khi Codex cần hiểu hiện trạng, phải đọc các file này trước:

## Backend / bridge / data
- `CHATBOT AI.md`
- `CHANGELOG-SCANNER-V4.md`
- `prisma/schema.prisma`
- `src/app/api/bridge/[[...path]]/route.ts`
- `src/lib/fiinquantClient.ts`
- `src/lib/PriceCache.ts`
- `src/lib/UltimateSignalEngine.ts`
- `src/lib/SignalLifecycleWorker.ts`
- `src/lib/dnseClient.ts`
- `src/lib/widget-service.ts`
- `src/lib/marketDataFetcher.ts`

## Frontend routes
- `src/app/dashboard/page.tsx`
- `src/app/stock/[ticker]/page.tsx`
- `src/app/terminal/page.tsx`
- `src/app/backtest/page.tsx`
- `src/app/portfolio/page.tsx`
- `src/app/signal-map/page.tsx`
- `src/app/rs-rating/page.tsx`

## Deploy/runtime
- `docker-compose.yml`
- `.env.example`
- `DEPLOY.md`
- `DEPLOY_RUNBOOK.md`

## Nếu phải sửa AI flow
- tuyệt đối đọc cache tables trong Prisma schema trước
- tuyệt đối kiểm tra endpoint bridge hiện có trước
- tuyệt đối ưu tiên reuse các batch endpoint đã có trước khi tạo endpoint mới
