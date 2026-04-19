# ADN Capital Rebuild Plan v3.2

> Mục tiêu: rebuild ADN Capital theo pattern đã rút ra từ Fincept nhưng **không rewrite stack**, vẫn giữ Next.js + Python bridge + Postgres/PgBouncer + Docker Compose hiện tại. Bản v3.2 này sửa các điểm còn rủi ro trong v3.1 để Codex có thể triển khai an toàn hơn.

---

## 1) Executive Summary

### Mục tiêu chính
- Đưa toàn bộ data flow quan trọng về **DataHub topic-based**.
- Tách rõ **deterministic core** khỏi **AI explanation layer**.
- Chuẩn hóa scanner / brief / signal / broker sync theo lịch cố định.
- Hợp nhất UX dữ liệu theo mô hình **ticker research workbench**.
- Làm DNSE sync theo **từng user / từng connection**, không dùng shared broker state.

### Guardrails cứng
- **Không rewrite stack** sang desktop / Qt / microservices mới.
- **Không để AI sinh tín hiệu gốc**.
- **Không deploy bằng `docker compose down`** trong runbook mặc định.
- **Không để cả `web` và `fiinquant` cùng sở hữu cache topic**.
- **Không trộn dữ liệu public market với dữ liệu private của user**.

### 7 thay đổi quan trọng so với v3.1
1. **Hub owner = `web`**. Chỉ `web` được quyền giữ cache topic và serve topic cho frontend.
2. **Scheduler owner = `fiinquant`**. Chỉ Python bridge chạy job định kỳ / slot-gated.
3. **Chuẩn hóa env/docs trước khi code**. Một source-of-truth cho bridge URL, DB URL và deploy rule.
4. **Tách public topics và private topics**. Không dùng `broker:dnse:default:*` nữa.
5. **Đổi thứ tự migrate UI** thành `dashboard -> terminal -> stock/[ticker] -> rs-rating -> signal-map -> portfolio`.
6. **Workflow v1 thu gọn scope**. Chỉ làm trigger/action thiết yếu, chưa làm platform automation tổng quát.
7. **Chuẩn hóa canonical key theo ngày/slot** cho brief và scheduler aliases để audit/debug dễ.

---

## 2) Architecture Decisions cần chốt ngay

## A. Ownership Model

### A1. `web` là owner của DataHub
`web` chịu trách nhiệm cho:
- topic registry
- TTL / freshness / minInterval
- in-flight dedupe
- batch topic read
- invalidate / refresh topic
- hooks `useTopic()` / `useTopics()`
- API `/api/hub/*`

`fiinquant` **không** giữ một hub riêng. `fiinquant` chỉ là:
- compute engine
- provider runtime
- scheduler runtime
- producer upstream qua HTTP/internal API hoặc qua DB result tables

### A2. `fiinquant` là owner của scheduler
`fiinquant` chịu trách nhiệm cho:
- APScheduler / cron slot scheduling
- deterministic scans
- brief generation jobs
- market stats jobs
- broker sync jobs (nếu chọn Python-side worker)
- idempotency theo `job_name + slot + trading_date`

`web` không được tự chạy cron song song cho các job này.

### A3. DB ownership
- `db` là persistence layer cho user state, signal lifecycle state, broker connection state, execution logs, job health, report snapshots.
- `web` và `fiinquant` đều có thể đọc DB.
- Ghi DB cần tuân thủ domain ownership, tránh 2 process cùng ghi cùng một logical state không có locking.

---

## 3) Phase 0 — Baseline & Freeze Decisions

Phase này là **bắt buộc** trước khi Codex code DataHub.

### 3.1. Chuẩn hóa source-of-truth cho env và deploy
Tạo một file duy nhất, ví dụ:
- `docs/ops/SOURCE_OF_TRUTH.md`

Trong đó chốt:
- `DATABASE_URL` -> luôn trỏ **PgBouncer**
- `DIRECT_DATABASE_URL` -> luôn trỏ **Postgres direct**
- Chỉ dùng **một** tên bridge URL chuẩn, khuyến nghị:
  - `PYTHON_BRIDGE_URL`
- Các chỗ đang dùng `FIINQUANT_URL` hay hardcode `http://fiinquant:8000` phải được normalize về cùng một contract.

### 3.2. Chuẩn hóa deploy mặc định
Safe deploy mặc định:
```bash
docker compose build --no-cache web
docker compose up -d web
```

Không dùng mặc định:
```bash
docker compose down
```

Chỉ cho phép `down` trong tình huống đặc biệt có documented incident procedure.

### 3.3. Chuẩn hóa job schedule (Asia/Ho_Chi_Minh)

#### Signal scan type 1
- `10:00`
- `10:30`
- `14:00`
- `14:20`

#### Market stats type 2
- `10:00`
- `11:30`
- `14:00`
- `14:45`

#### Brief type 3
- `08:00` -> Morning Brief
- `15:00` -> Close Brief
- `19:00` -> EOD Full

### 3.4. Chuẩn hóa scheduler naming
Tên canonical:
- `signal_scan_type1`
- `market_stats_type2`
- `morning_brief`
- `close_brief_15h`
- `eod_full_19h`

Alias tương thích ngược:
- `signal_scan_5m` -> alias logic only, **không** có nghĩa là chạy mỗi 5 phút.

### 3.5. Freeze AI policy
AI chỉ làm:
- explain
- summarize
- compare
- personalize
- translate data -> narrative

AI không làm:
- tạo tín hiệu gốc
- tự quyết định lifecycle transitions
- tự thay risk engine / conflict rules
- tự override broker truth

### 3.6. Trading calendar guard
Mọi cron/job phải đi qua:
- trading day guard
- trading session guard
- holiday/weekend guard
- idempotency guard

---

## 4) Phase 1 — DataHub Foundation (Web-owned)

## 4.1. DataHub responsibilities
Tạo một DataHub core trong `web` với các khả năng sau:
- topic registry
- TTL
- minInterval
- in-flight dedupe
- stale/fresh envelope
- invalidate by topic
- invalidate by tag
- batch read
- forced refresh
- optional SWR-like stale serving

## 4.2. Gợi ý cấu trúc thư mục
```txt
src/
  lib/
    hub/
      registry.ts
      types.ts
      envelope.ts
      cache.ts
      invalidate.ts
      producer-context.ts
      producers/
        market.ts
        news.ts
        signal.ts
        research.ts
        portfolio.ts
        broker.ts
      topics/
        public.ts
        private.ts
  app/
    api/
      hub/
        topic/[...topicKey]/route.ts
        topics/route.ts
        invalidate/route.ts
      internal/
        jobs/
          notify/route.ts
```

## 4.3. Hub API contracts
### Read one topic
`GET /api/hub/topic/{topicKey}`

### Read many topics
`POST /api/hub/topics`

Body ví dụ:
```json
{
  "topics": [
    "vn:index:overview",
    "research:workbench:HPG"
  ]
}
```

### Invalidate topic(s)
`POST /api/hub/invalidate`

Body ví dụ:
```json
{
  "topics": ["vn:index:overview"],
  "tags": ["market", "brief"]
}
```

### Internal job notify từ `fiinquant`
`POST /api/internal/jobs/notify`

Body ví dụ:
```json
{
  "job": "morning_brief",
  "slot": "2026-04-18T08:00:00+07:00",
  "status": "success",
  "invalidateTopics": [
    "brief:morning:2026-04-18",
    "brief:morning:latest"
  ],
  "invalidateTags": ["brief", "morning-brief"]
}
```

## 4.4. Envelope contract chuẩn
Mọi topic trả cùng shape:
```ts
interface TopicEnvelope<T> {
  topic: string;
  value: T | null;
  updatedAt: string;
  expiresAt: string;
  freshness: 'fresh' | 'stale' | 'expired' | 'error';
  source: 'web' | 'fiinquant' | 'db' | 'dnse' | 'computed';
  version: string;
  tags?: string[];
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
  };
}
```

## 4.5. Topic taxonomy — tách public và private

### Public market topics
```txt
vn:index:overview
vn:index:snapshot
vn:index:breadth:VNINDEX
vn:ta:{ticker}
vn:fa:{ticker}
vn:seasonality:{ticker}
vn:investor:{ticker}
news:ticker:{ticker}
research:workbench:{ticker}
signal:market:radar
signal:market:active
brief:morning:{yyyy-mm-dd}
brief:morning:latest
brief:close:{yyyy-mm-dd}:15h
brief:close:latest
brief:eod:{yyyy-mm-dd}:19h
brief:eod:latest
```

### Private per-user topics
```txt
portfolio:user:{userId}:overview
portfolio:user:{userId}:holdings
portfolio:holding:{userId}:{ticker}
signal:user:{userId}:portfolio
signal:user:{userId}:conflicts
broker:dnse:{connectionId}:positions
broker:dnse:{connectionId}:orders
broker:dnse:{connectionId}:balance
broker:dnse:{connectionId}:holdings
watchlist:user:{userId}
```

### Quy tắc bắt buộc
- `research:workbench:{ticker}` chỉ aggregate **public** layers.
- Nếu cần overlay dữ liệu user trên màn ticker, fetch thêm private topics riêng.
- Không dùng `broker:dnse:default:*`.
- Không nhét private broker state vào topic public theo ticker.

## 4.6. Topic metadata gợi ý
Ví dụ registry:
```ts
{
  "vn:index:overview": {
    ttlMs: 60_000,
    minIntervalMs: 15_000,
    tags: ["market", "index"]
  },
  "research:workbench:{ticker}": {
    ttlMs: 300_000,
    minIntervalMs: 30_000,
    tags: ["research", "ticker"]
  },
  "brief:morning:{date}": {
    ttlMs: 24 * 60 * 60 * 1000,
    minIntervalMs: 60_000,
    tags: ["brief", "morning-brief"]
  },
  "broker:dnse:{connectionId}:positions": {
    ttlMs: 30_000,
    minIntervalMs: 10_000,
    tags: ["broker", "dnse", "private"]
  }
}
```

## 4.7. Hooks
- `useTopic(topicKey, options)`
- `useTopics(topicKeys, options)`

Options tối thiểu:
- `enabled`
- `staleWhileRevalidate`
- `forceRefresh`
- `pollMs` (chỉ cho phép ở UI nếu thật sự cần)

Nguyên tắc: UI **không tự fetch trực tiếp** data domain sau khi migrate vào DataHub.

---

## 5) Phase 2 — Migrate UI theo thứ tự mới

Thứ tự migrate chuẩn:
1. `dashboard`
2. `terminal`
3. `stock/[ticker]`
4. `rs-rating`
5. `signal-map`
6. `portfolio`

## 5.1. Tại sao thứ tự này hợp lý hơn
- `dashboard` giải quyết pain lớn nhất về duplicate fetch.
- `terminal` và `stock/[ticker]` validate được mô hình per-ticker research sớm.
- `rs-rating` và `signal-map` tận dụng tốt public topics đã ổn định.
- `portfolio` để sau vì đây là nơi private broker/user state phức tạp nhất.

## 5.2. UI migration rules
- Cấm direct fetch lặp ở component con nếu topic đã tồn tại.
- Mọi card quan trọng phải đọc cùng envelope để hiển thị freshness/stale state nhất quán.
- Placeholder phải chuẩn hóa:
  - loading -> skeleton
  - empty -> empty state thật
  - error -> error state có retry
- Không hiển thị placeholder rác kiểu `—`, `0000`, `Updating...` nếu thiếu contract.

## 5.3. Dashboard requirements
- full-width responsive grid
- không co card vào giữa khi còn không gian ngang
- có freshness badge cho các khối market / brief / signal
- morning / eod cards đọc đúng topic canonical + latest alias

---

## 6) Phase 3 — Ticker Research Workbench

Refactor `stock/[ticker]` thành workbench chuẩn.

## 6.1. 8 tabs đề xuất
1. Tổng quan
2. TA
3. FA
4. Tâm lý / dòng tiền
5. News
6. Seasonality
7. Signal
8. Portfolio overlay

## 6.2. Aggregate topic
Topic chính:
```txt
research:workbench:{ticker}
```

Nó chỉ aggregate public layers:
- quote / overview
- ta summary
- fa summary
- seasonality
- investor sentiment / flows
- signal snapshot public
- news snapshot

Private overlay fetch riêng:
- `portfolio:holding:{userId}:{ticker}`
- `signal:user:{userId}:conflicts`

## 6.3. Chat placement
- Chat là panel phụ / drawer / side panel.
- Chat không được phá luồng research chính.
- Chat đọc từ cùng source data với workbench để giảm hallucination.

## 6.4. Ticker resolver
- Hỗ trợ ticker ngoài watchlist.
- Resolver phải validate ticker toàn thị trường trước khi render workbench.

---

## 7) Phase 4 — Python-first Provider Manifests

## 7.1. Mục tiêu
Chuẩn hóa scanner / backtest theo contract manifest-driven để frontend render cấu hình động.

## 7.2. Trách nhiệm
### `fiinquant`
- giữ source-of-truth cho provider logic
- expose manifest
- run scanner/backtest
- trả structured result

### `web`
- render form theo manifest
- validate client/server basic schema
- hiển thị result
- lưu execution history / presets nếu cần

## 7.3. Contracts
### Backtest
- `GET /api/v1/providers/backtest/manifest`
- `POST /api/v1/providers/backtest/run`

### Scanner
- `GET /api/v1/providers/scanner/manifest`
- `POST /api/v1/providers/scanner/run`

## 7.4. Manifest shape gợi ý
```json
{
  "provider": "rs_breakout_v1",
  "label": "RS Breakout v1",
  "type": "scanner",
  "inputs": [
    {"key": "universe", "type": "select", "required": true},
    {"key": "lookback", "type": "number", "required": true},
    {"key": "minLiquidity", "type": "number", "required": false}
  ],
  "version": "1.0.0"
}
```

## 7.5. Fallback rule
- Nếu local workspace có source Python đầy đủ -> triển khai registry thật ở Python.
- Nếu source thiếu -> làm contract-first adapters + stub-safe fallback có warning log rõ ràng.

## 7.6. Nguyên tắc cứng
- Scanner vẫn deterministic.
- AI chỉ viết explanation / summary sau khi có result.

---

## 8) Phase 5 — DNSE-first Broker Sync

## 8.1. Authentication model tách 2 lớp
### System-level credentials
Dùng cho market/public endpoints server-side:
- `DNSE_API_KEY`

### User-level credentials
Dùng cho sync tài khoản người dùng:
- access token / refresh token / session token theo DNSE flow thực tế
- lưu encrypted trong DB
- map vào `broker connection`

## 8.2. Dữ liệu cần sync
- positions
- orders
- balance
- holdings
- optional executions / transactions nếu có contract đủ rõ

## 8.3. Topic model mới
Không dùng:
```txt
broker:dnse:default:positions
```

Phải dùng:
```txt
broker:dnse:{connectionId}:positions
broker:dnse:{connectionId}:orders
broker:dnse:{connectionId}:balance
broker:dnse:{connectionId}:holdings
```

Nếu UI cần shorthand hiện tại, server có thể resolve alias:
```txt
broker:dnse:current-user:positions
```
nhưng alias này chỉ tồn tại ở layer resolve, không là canonical storage key.

## 8.4. Sync flow bắt buộc
1. User connect DNSE ở web.
2. Backend nhận token.
3. Token được mã hóa và lưu DB.
4. `fiinquant` hoặc worker domain sync định kỳ.
5. Job thành công ghi DB snapshot / result.
6. Job notify `web` để invalidate topic broker liên quan.
7. `portfolio`, `risk`, `signal conflict` đọc từ topic / snapshot đã chuẩn hóa.

## 8.5. Merge rule broker vs internal state
Phải có merge policy rõ ràng:
- broker positions là truth cho actual holdings thực chiến
- internal portfolio/journal là layer bổ sung metadata
- nếu conflict:
  - quantity / cash / orders -> ưu tiên broker
  - tags / thesis / note / custom stop -> ưu tiên internal

---

## 9) Phase 6 — Workflow Automation Runtime v1

Bản v1 phải **thu gọn scope**.

## 9.1. Chỉ làm 5 trigger đầu tiên
- cron
- signal status changed
- market threshold hit
- portfolio risk threshold hit
- brief ready

## 9.2. Chỉ làm 5 action đầu tiên
- invalidate topic
- refresh topic
- run scan
- send telegram
- write report / log

## 9.3. Chưa làm ở v1
- visual flow builder tổng quát
- nested branching sâu
- no-code automation platform đầy đủ
- arbitrary scripting user-defined

## 9.4. Runtime requirements
- execution log
- basic retry
- dead-letter state đơn giản
- idempotency key
- audit trail theo workflow / run / trigger

---

## 10) Phase 7 — Hardening & Observability

## 10.1. Logging chuẩn hóa
Mọi domain chính cần log theo:
- topic
- owner
- producer
- cache hit/miss
- latency
- freshness
- error code
- job slot
- userId / connectionId nếu là private domain (có masking nếu cần)

## 10.2. Cron health dashboard
Tối thiểu cần có:
- `lastRun`
- `lastSuccess`
- `lastError`
- `durationMs`
- `slot`
- `isStale`

## 10.3. Trading-hour stale alerts
Trong giờ giao dịch, nếu topic quan trọng stale quá ngưỡng, phải có cảnh báo cho admin / ops.

## 10.4. Legacy cleanup
Sau mỗi phase migrate:
- xoá direct fetch cũ
- xoá timer polling cũ
- xoá env aliases không còn dùng
- cập nhật docs/runbook

---

## 11) Canonical Keys & Alias Policy

## 11.1. Brief keys
Canonical:
- `brief:morning:{yyyy-mm-dd}`
- `brief:close:{yyyy-mm-dd}:15h`
- `brief:eod:{yyyy-mm-dd}:19h`

Latest aliases:
- `brief:morning:latest`
- `brief:close:latest`
- `brief:eod:latest`

Rule:
- UI có thể đọc `latest`.
- Audit / history / debug / replay phải bám canonical key theo ngày/slot.

## 11.2. Scheduler aliases
Canonical job names nằm ở Phase 0.
Alias cũ chỉ dùng để không vỡ code legacy, không dùng làm tên nghiệp vụ mới.

---

## 12) Data Contracts cần ưu tiên

## 12.1. `research:workbench:{ticker}`
```json
{
  "ticker": "HPG",
  "overview": {},
  "ta": {},
  "fa": {},
  "seasonality": {},
  "investor": {},
  "news": [],
  "signal": {},
  "summary": {}
}
```

Chỉ chứa public market research.

## 12.2. `portfolio:holding:{userId}:{ticker}`
```json
{
  "ticker": "HPG",
  "quantity": 1000,
  "avgPrice": 25200,
  "marketValue": 0,
  "pnl": 0,
  "source": "broker",
  "notes": [],
  "thesis": null,
  "customRisk": {}
}
```

## 12.3. `signal:user:{userId}:conflicts`
```json
{
  "items": [
    {
      "ticker": "HPG",
      "type": "exit_vs_hold_conflict",
      "severity": "medium",
      "reason": "broker holding still open while internal signal moved to closed"
    }
  ]
}
```

---

## 13) Test Plan

## 13.1. DataHub
- TTL hoạt động đúng
- dedupe hoạt động đúng
- stale/fresh đúng theo topic metadata
- batch fetch đúng contract
- invalidate topic/tag hoạt động đúng
- private topics không bị cache leak sang user khác

## 13.2. Scheduler
- đúng slot giờ
- không chạy ngày nghỉ
- `signal_scan_5m` không chạy mỗi 5 phút thực tế
- retry + idempotency không tạo duplicate run

## 13.3. Market / Brief
- Morning đủ khối nội dung theo spec
- 15:00 close brief đúng format rút gọn
- 19:00 EOD đủ thanh khoản 3 sàn + nhóm nhà đầu tư + action summary
- latest alias luôn map đúng canonical key mới nhất

## 13.4. UI
- dashboard full-width responsive
- terminal / stock workbench dùng topic-based contract ổn định
- không còn placeholder rác
- freshness badge hiển thị nhất quán

## 13.5. Broker / DNSE
- user A không thấy data user B
- token lưu encrypted
- sync lỗi có fallback an toàn
- conflict merge đúng rule broker-vs-internal

## 13.6. AI / Chat
- cùng source data với workbench
- không sinh tín hiệu gốc
- explanation không phá deterministic status hiện có

## 13.7. Deploy safety
Sau deploy phải check:
- `DATABASE_URL` đúng PgBouncer
- `DIRECT_DATABASE_URL` đúng direct DB
- bridge URL được normalize
- user count > 0
- `/api/health` ổn
- smoke test dashboard / terminal / signals / brief

---

## 14) Rollout Plan cho Codex

## Sprint 1
- Phase 0 full
- normalize env/docs/deploy
- tạo DataHub skeleton + registry + envelope + basic APIs

## Sprint 2
- migrate `dashboard`
- migrate `terminal`
- add freshness badges + placeholder policy

## Sprint 3
- build `research:workbench:{ticker}`
- refactor `stock/[ticker]`
- integrate chat as side panel

## Sprint 4
- provider manifests cho scanner/backtest
- stub-safe fallback nếu Python source thiếu

## Sprint 5
- DNSE connection model + encrypted token storage + private broker topics
- migrate `portfolio`

## Sprint 6
- workflow v1
- cron health dashboard
- legacy cleanup + hardening

---

## 15) Codex Execution Notes

Codex phải tuân thủ các rule sau:
- Không tự tạo thêm service mới nếu chưa thật cần.
- Không thêm Redis/Kafka ở phase hiện tại.
- Không rewrite UI data layer bằng nhiều thư viện song song.
- Không dùng direct broker calls từ frontend.
- Không gộp public/private topics.
- Mọi thay đổi env phải cập nhật `SOURCE_OF_TRUTH.md`.
- Mọi endpoint mới phải có smoke-test hoặc contract-test tương ứng.

---

## 16) Approval Recommendation

Bản v3.2 này có thể dùng làm **plan chính thức cho Codex** vì đã sửa các rủi ro kiến trúc lớn nhất của v3.1:
- tránh split-brain cache giữa `web` và `fiinquant`
- tránh double-scheduler
- tránh env/docs tự mâu thuẫn
- tránh leak private broker state vào public research topics
- giảm scope workflow để rollout an toàn hơn

