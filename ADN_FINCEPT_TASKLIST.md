# ADN Capital x Fincept Pattern — TASKLIST thực thi cho Codex

> Tài liệu này là bản **execution plan** để Codex/Copilot code theo từng phase, không bị lan man, không rewrite sai hướng, và không biến ADN thành một app “AI trước, deterministic sau”.
>
> File này phải được dùng cùng với: `ADN_FINCEPT_ARCHITECTURE.md`.
>
> Quy tắc ưu tiên nguồn sự thật:
> 1. **Local workspace hiện tại của bạn**
> 2. `ADN_FINCEPT_ARCHITECTURE.md`
> 3. `CHATBOT AI.md`
> 4. `CHANGELOG-SCANNER-V4.md`
> 5. public repo snapshot trên GitHub

---

## 1. Mục tiêu của tasklist này

Codex phải giúp ADN Capital tiến hóa thành một **web terminal cho chứng khoán Việt Nam** theo 5 trụ cột:

1. **DataHub + Topic Registry**
2. **Python-first provider architecture cho scanner/backtest**
3. **Ticker Research Workbench**
4. **Broker/Portfolio stream theo topic, DNSE-first**
5. **Workflow automation**

Mục tiêu không phải là “copy Fincept”, mà là:
- mượn **pattern orchestration và data contracts**,
- giữ nguyên **stack web hiện tại**,
- tối ưu cho **VN equities**,
- triển khai **theo từng phase deploy được**.

---

## 2. Working agreement cho Codex

### 2.1. Không được làm
- Không rewrite sang Qt/C++.
- Không copy code từ FinceptTerminal.
- Không thêm Redis/Kafka/MQTT ở giai đoạn đầu.
- Không cho LLM sinh BUY/SELL signal gốc.
- Không hardcode strategy list ở frontend nếu backend/provider có thể trả manifest.
- Không tạo mỗi widget một API polling loop riêng nếu DataHub topic đã có.
- Không tạo file bridge Python “tưởng tượng” nếu local workspace không có source tương ứng.

### 2.2. Bắt buộc phải làm
- Làm **theo phase**, không nhảy cóc.
- Mỗi phase phải có **Definition of Done** rõ ràng.
- Giữ tương thích deploy hiện tại.
- Reuse tối đa các module đang có trước khi tạo abstraction mới.
- Mọi API/topic/cache mới phải có:
  - owner,
  - TTL,
  - invalidation rule,
  - fallback,
  - logging.

### 2.3. Quy tắc về bridge Python
Nếu local workspace **có** source Python bridge, hãy sửa trực tiếp theo plan.

Nếu local workspace **không có** source Python bridge đầy đủ, thì:
- chỉ tạo **TypeScript contracts, adapters, manifests, docs, API proxy contracts** ở repo này,
- không tự bịa `main.py`, `providers/`, `scanner.py` mới nếu repo không chứa chúng,
- ghi rõ TODO phụ thuộc “bridge repo/source external”.

### 2.4. Quy tắc về AI
AI chỉ được dùng cho:
- explanation,
- summarization,
- personalization,
- briefing,
- notification content.

AI không được dùng cho:
- signal generation gốc,
- risk engine gốc,
- final widget JSON assembly.

---

## 3. Reality check trước khi code

Codex phải đọc các file sau trước khi tạo patch đầu tiên:

### 3.1. Bắt buộc đọc
- `ADN_FINCEPT_ARCHITECTURE.md`
- `CHATBOT AI.md`
- `CHANGELOG-SCANNER-V4.md`
- `prisma/schema.prisma`
- `src/app/api/bridge/[[...path]]/route.ts`
- `src/lib/fiinquantClient.ts`
- `src/lib/PriceCache.ts`
- `src/lib/UltimateSignalEngine.ts`
- `src/lib/SignalLifecycleWorker.ts`
- `src/lib/dnseClient.ts`
- `src/app/dashboard/page.tsx`
- `src/app/stock/[ticker]/page.tsx`
- `src/app/terminal/page.tsx`
- `src/app/backtest/page.tsx`
- `src/app/portfolio/page.tsx`
- `src/app/signal-map/page.tsx`
- `src/app/rs-rating/page.tsx`
- `docker-compose.yml`
- `package.json`

### 3.2. Ghi chú thực tế quan trọng
- Public repo cho thấy `src/app`, `src/lib`, `prisma`, `docker-compose.yml` đều đang là phần lõi của app.
- `docker-compose.yml` đang bám kiến trúc: `db`, `pgbouncer`, `web`, `fiinquant`, `nginx`.
- `/api/bridge/[[...path]]` đang proxy request sang `http://fiinquant:8000`.
- `fiinquantClient.ts` đã có wrappers cho market overview, TA summary, RS rating, prop trading, market breadth, intraday snapshot, realtime, scan-now, investor trading.
- `CHATBOT AI.md` mô tả thêm nhiều endpoint bridge đã tồn tại như `historical`, `fundamental`, `seasonality`, `batch-price`, `batch-exit-scan`, `leader-radar`, `index-valuation`, `rpi`.
- Public repo có dấu hiệu thư mục `fiinquant-bridge` không đầy đủ source; vì vậy phải để local workspace quyết định có sửa bridge trực tiếp hay không.

### 3.3. Nếu local workspace khác public repo
Nếu phát hiện local workspace khác public repo:
- ưu tiên **local workspace**,
- tạo file `docs/implementation/local-reality-notes.md`,
- ghi lại chênh lệch để tránh Codex tiếp tục code dựa trên assumption sai.

---

## 4. Thứ tự triển khai bắt buộc

Làm theo đúng thứ tự này:

1. **Phase 0 — Baseline & repo truth**
2. **Phase 1 — DataHub foundation**
3. **Phase 2 — Migrate page data flow sang topic-based UI**
4. **Phase 3 — Ticker Research Workbench**
5. **Phase 4 — Python-first provider manifests cho scanner/backtest**
6. **Phase 5 — DNSE-first broker topics**
7. **Phase 6 — Workflow automation runtime**
8. **Phase 7 — Hardening, logging, docs, cleanup**

Không làm Phase 4/5/6 khi Phase 1 chưa ổn.

---

## 5. Phase 0 — Baseline & repo truth

### 5.1. Mục tiêu
Tạo một baseline chính xác để Codex không code dựa trên giả định sai về source tree, scripts, bridge source và DB schema.

### 5.2. Việc phải làm
- [ ] Kiểm tra local workspace có thực sự chứa source Python bridge hay chỉ có Dockerfile.
- [ ] Kiểm tra `schema.prisma` hiện có các model nào liên quan đến `Signal`, `Notification`, AI cache, portfolio, broker.
- [ ] Kiểm tra `src/app/stock/[ticker]/page.tsx` đang render theo flow nào.
- [ ] Kiểm tra `dashboard`, `terminal`, `portfolio`, `signal-map`, `rs-rating` đang lấy data trực tiếp từ đâu.
- [ ] Tạo file `docs/implementation/current-state-audit.md`.
- [ ] Trong file audit, map từng page → API calls → cache hiện tại → candidate topics.

### 5.3. Deliverables
- `docs/implementation/current-state-audit.md`
- `docs/implementation/local-reality-notes.md` (nếu cần)

### 5.4. Definition of Done
- Có một bảng/markdown map rõ:
  - page nào đang gọi endpoint nào,
  - module cache nào đang dùng,
  - file nào là owner của business logic,
  - file nào đang trùng responsibility.
- Không còn ambiguity về chuyện bridge source ở đâu.

### 5.5. PR gợi ý
`docs: add current state audit for ADN Fincept migration`

---

## 6. Phase 1 — DataHub foundation

### 6.1. Mục tiêu
Tạo lớp điều phối dữ liệu trung tâm cho ADN theo pattern Fincept, nhưng vẫn in-process trong Next.js runtime.

### 6.2. File/folder cần tạo
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
        newsProducer.ts
        signalProducer.ts
        researchProducer.ts
        portfolioProducer.ts
        brokerProducer.ts
  hooks/
    useTopic.ts
    useTopics.ts
  app/
    api/
      hub/
        topic/
          [...topic]/route.ts
        topics/route.ts
        invalidate/route.ts
```

### 6.3. Topic set đầu tiên bắt buộc
Tạo registry ít nhất cho các topic sau:

```text
vn:index:overview
vn:index:snapshot
vn:index:breadth:VNINDEX
news:morning:latest
news:eod:latest
signal:radar
signal:active
signal:portfolio:current-user
vn:ta:{ticker}
vn:fa:{ticker}
vn:seasonality:{ticker}
vn:realtime:{ticker}:5m
vn:investor:{ticker}
research:workbench:{ticker}
broker:dnse:default:positions
broker:dnse:default:orders
broker:dnse:default:balance
broker:dnse:default:holdings
```

### 6.4. Việc phải làm
- [ ] Tạo `TopicDefinition`, `TopicState`, `TopicEnvelope`, `TopicResolver`, `ProducerRefreshContext`.
- [ ] Tạo registry có metadata: `key pattern`, `ttlMs`, `minIntervalMs`, `owner`, `staleWhileRevalidate`, `tags`.
- [ ] Tạo in-memory cache cho topic values.
- [ ] Tạo in-flight dedupe: cùng 1 topic chỉ được fetch 1 lần tại 1 thời điểm.
- [ ] Tạo `get(topic)`, `getMany(topics)`, `invalidate(topic|tag)`.
- [ ] Tạo producer interface.
- [ ] Tạo market producer dùng lại `fiinquantClient.ts`.
- [ ] Tạo news producer dùng lại các endpoint morning/eod.
- [ ] Tạo signal producer dùng lại DB + `UltimateSignalEngine`/signal tables hiện có.
- [ ] Tạo research producer để assemble `research:workbench:{ticker}` từ nhiều nguồn.
- [ ] Tạo broker producer ở trạng thái stub-safe nếu broker data chưa đầy đủ.
- [ ] Tạo API route đọc 1 topic.
- [ ] Tạo API route batch topics.
- [ ] Tạo API route invalidate.
- [ ] Tạo `useTopic()` và `useTopics()` hooks.
- [ ] Đảm bảo response có metadata: `fresh`, `stale`, `fetchedAt`, `expiresAt`, `source`, `error`.

### 6.5. Không làm trong phase này
- Không thêm WebSocket broker ngoài.
- Không thêm Redis.
- Không migrate toàn bộ UI một lúc.
- Không refactor business logic scanner/backtest trong phase này.

### 6.6. Acceptance criteria
- [ ] Có thể gọi `/api/hub/topic/vn:index:overview` và nhận payload đúng shape.
- [ ] Có thể gọi batch topics 1 request.
- [ ] Cùng 1 topic khi bị gọi song song phải dedupe fetch.
- [ ] Có thể invalidate theo topic key hoặc tag.
- [ ] Có test/unit check tối thiểu cho registry + cache + dedupe.

### 6.7. PR gợi ý
`feat(datahub): add in-process topic registry and hub core`

---

## 7. Phase 2 — Migrate page data flow sang topic-based UI

### 7.1. Mục tiêu
Đưa các page quan trọng sang dùng DataHub từng bước, không làm gãy UI.

### 7.2. Thứ tự migrate
1. `dashboard`
2. `signal-map`
3. `rs-rating`
4. `terminal`
5. `portfolio`

### 7.3. Việc phải làm
- [ ] `dashboard/page.tsx`: thay direct fetch bằng `useTopics()`.
- [ ] `signal-map/page.tsx`: dùng `signal:radar`, `signal:active`, `vn:index:overview`.
- [ ] `rs-rating/page.tsx`: thay direct wrapper bằng topic hóa phù hợp.
- [ ] `terminal/page.tsx`: giữ UI hiện tại, chỉ thay data orchestration layer.
- [ ] `portfolio/page.tsx`: ưu tiên dùng `signal:portfolio:current-user` + broker topics nếu sẵn.
- [ ] Nếu page có nhiều widget trùng endpoint, gom lại thành batch topics.
- [ ] Bỏ các polling loop thừa ở component level nếu topic đã quản lý refresh.

### 7.4. Mapping tối thiểu gợi ý
- `dashboard` → `vn:index:overview`, `vn:index:snapshot`, `vn:index:breadth:VNINDEX`, `news:morning:latest`, `signal:active`
- `signal-map` → `signal:radar`, `signal:active`, `vn:index:overview`
- `rs-rating` → topic riêng hoặc `scan:rs-rating:list`
- `terminal` → `vn:index:*`, `news:*`, `signal:*`, `research:workbench:{ticker}`
- `portfolio` → `broker:dnse:*`, `signal:portfolio:current-user`

### 7.5. Acceptance criteria
- [ ] Ít nhất 3 page lớn đã dùng DataHub.
- [ ] Giảm direct calls từ page/component xuống còn qua `useTopic/useTopics`.
- [ ] UI không thay đổi mạnh về layout.
- [ ] Không xuất hiện duplicate request vô ích trong 1 lần render/hydration.

### 7.6. PR gợi ý
`refactor(ui): migrate dashboard and market pages to datahub topics`

---

## 8. Phase 3 — Ticker Research Workbench

### 8.1. Mục tiêu
Biến `stock/[ticker]` thành một **research workspace chuẩn cho cổ phiếu Việt Nam**, thay vì chỉ là page chat/phân tích rời rạc.

### 8.2. Route giữ nguyên
- Giữ route: `src/app/stock/[ticker]/page.tsx`
- Có thể tách component dưới `src/components/stock-workbench/*`

### 8.3. File/folder gợi ý
```text
src/
  components/
    stock-workbench/
      WorkbenchShell.tsx
      WorkbenchHeader.tsx
      OverviewTab.tsx
      TechnicalTab.tsx
      FundamentalTab.tsx
      SentimentTab.tsx
      NewsTab.tsx
      SeasonalityTab.tsx
      SignalTab.tsx
      PortfolioTab.tsx
      hooks.ts
```

### 8.4. Data contract bắt buộc
Tạo topic aggregate:

```text
research:workbench:{ticker}
```

Payload aggregate phải gồm tối thiểu:
- `ticker`
- `price/realtime`
- `taSummary`
- `fundamental`
- `seasonality`
- `investorTrading`
- `morning/eod/news slice`
- `activeSignal`
- `holdingContext`
- `aiCaches` nếu có

### 8.5. Tab bắt buộc
- [ ] Tổng quan
- [ ] TA
- [ ] FA
- [ ] Tâm lý & Dòng tiền
- [ ] News
- [ ] Seasonality
- [ ] Signal
- [ ] Portfolio

### 8.6. Việc phải làm
- [ ] Refactor `stock/[ticker]/page.tsx` thành shell + tabs.
- [ ] Dùng `research:workbench:{ticker}` làm aggregate data source chính.
- [ ] Chỉ cho từng tab gọi topic con khi thực sự cần lazy-load sâu hơn.
- [ ] Giữ tương thích với các AI cache tables hiện có.
- [ ] Nếu user đang nắm giữ mã hoặc hệ thống có ACTIVE signal, phần Signal/Portfolio phải dùng context đó để hiển thị action-oriented summary.
- [ ] Không để AI tự assemble toàn bộ payload của workbench.

### 8.7. Acceptance criteria
- [ ] `stock/[ticker]` có trải nghiệm giống 1 research terminal page.
- [ ] 1 request aggregate có thể render tab Tổng quan.
- [ ] Các tab sâu hơn không nhân bản fetch vô ích.
- [ ] Có thể thêm ticker mới mà không cần hardcode component logic riêng cho từng mã.

### 8.8. PR gợi ý
`feat(workbench): refactor stock page into topic-driven research workspace`

---

## 9. Phase 4 — Python-first provider manifests cho scanner/backtest

### 9.1. Mục tiêu
Không để frontend hardcode chiến lược. Scanner/backtest phải có manifest do backend/provider định nghĩa.

### 9.2. Hai trường hợp triển khai

#### Trường hợp A — local workspace có bridge source
Làm đầy đủ provider architecture ở bridge.

#### Trường hợp B — local workspace không có bridge source
Chỉ làm trước:
- contract types,
- manifest client,
- UI dynamic form,
- adapter layer,
- mock/stub-safe fallback.

### 9.3. Contracts bắt buộc
#### Backtest manifest
```json
{
  "provider": "vn_breakout_suite",
  "version": "1.0.0",
  "label": "VN Breakout Suite",
  "parameters": [
    { "key": "lookback", "type": "number", "default": 20 },
    { "key": "minVolumeRatio", "type": "number", "default": 1.5 },
    { "key": "universe", "type": "select", "options": ["VN30", "HOSE", "ALL"] }
  ]
}
```

#### Run contracts
- `POST /api/v1/providers/backtest/run`
- `GET /api/v1/providers/backtest/manifest`
- `POST /api/v1/providers/scanner/run`
- optional: `GET /api/v1/providers/scanner/manifest`

### 9.4. Strategy families hợp lý cho CK Việt Nam
- Breakout / pivot breakout
- RS leadership
- VCP / base contraction
- Bullish divergence
- Mean reversion near major MA
- Volume expansion
- Market breadth confirmation
- Leader radar / regime-aware filters

### 9.5. Việc phải làm
- [ ] Tạo `src/types/provider-manifest.ts`.
- [ ] Tạo `src/lib/providers/client.ts`.
- [ ] Refactor `backtest/page.tsx` để render dynamic form từ manifest.
- [ ] Nếu scanner UI có config cứng, chuyển dần sang manifest-driven.
- [ ] Nếu local có bridge source: tạo `providers/registry`, `providers/backtests`, `providers/scanners` ở Python.
- [ ] Giữ `main.py` hoặc public entrypoint cũ tương thích nếu file đó tồn tại locally.
- [ ] Không gọi LLM trong scanner deterministic path.

### 9.6. Acceptance criteria
- [ ] Backtest page không còn hardcode toàn bộ parameter form.
- [ ] Có thể thêm provider mới mà UI không phải sửa logic lớn.
- [ ] Scanner deterministic path không phụ thuộc LLM.
- [ ] Nếu bridge source chưa có, UI vẫn chạy với stub manifest rõ ràng và có TODO documented.

### 9.7. PR gợi ý
`feat(backtest): add manifest-driven provider architecture`

---

## 10. Phase 5 — DNSE-first broker topics

### 10.1. Mục tiêu
Chuẩn hóa dữ liệu tài khoản/broker theo topic để dùng chung cho portfolio, notifications, AI context, signal monitoring.

### 10.2. Topic shape bắt buộc
```text
broker:dnse:default:positions
broker:dnse:default:orders
broker:dnse:default:balance
broker:dnse:default:holdings
broker:dnse:default:quote:{ticker}
```

### 10.3. Việc phải làm
- [ ] Audit `src/lib/dnseClient.ts` để hiểu data shape thật.
- [ ] Tạo broker producer trong DataHub.
- [ ] Chuẩn hóa shape `positions/orders/balance/holdings`.
- [ ] Tạo merge rule giữa broker data và internal portfolio state.
- [ ] `portfolio/page.tsx` ưu tiên consume từ broker topics.
- [ ] Thêm risk summary nhỏ: concentration, unrealized P/L, liquidity risk, signal conflict.
- [ ] Nếu schema hiện tại chưa đủ, thêm migration cẩn thận cho snapshots hoặc broker account metadata.

### 10.4. Prisma additions chỉ khi thật cần
Chỉ thêm nếu local schema chưa có tương đương:
- `BrokerAccount`
- `BrokerPositionSnapshot`
- `BrokerOrderSnapshot`
- `BrokerBalanceSnapshot`
- `PortfolioHolding` hoặc bảng map tương đương

### 10.5. Acceptance criteria
- [ ] Portfolio page lấy được ít nhất 1 nguồn chuẩn hóa từ broker topics.
- [ ] Có owner rõ cho dữ liệu positions/orders/balance.
- [ ] Có fallback an toàn nếu broker API lỗi.
- [ ] Không làm rò token/secret ra client.

### 10.6. PR gợi ý
`feat(broker): add dnse topic producers and portfolio merge layer`

---

## 11. Phase 6 — Workflow automation runtime

### 11.1. Mục tiêu
Tạo runtime automation dạng JSON-first để chạy alert, refresh topic, scan, report mà chưa cần visual node editor.

### 11.2. Trigger types đầu tiên
- cron
- signal status changed
- market threshold crossed
- portfolio risk threshold crossed
- morning/eod report ready

### 11.3. Action types đầu tiên
- invalidate topic
- refresh topic
- run scanner
- create notification
- send Telegram
- persist report/log

### 11.4. File/folder gợi ý
```text
src/
  lib/
    automation/
      types.ts
      registry.ts
      engine.ts
      triggers.ts
      actions.ts
      runner.ts
      guards.ts
```

### 11.5. Việc phải làm
- [ ] Tạo JSON workflow schema.
- [ ] Tạo workflow registry.
- [ ] Tạo runner có log execution.
- [ ] Tạo ít nhất 3 workflow mặc định:
  - morning market brief refresh,
  - active signal change notification,
  - portfolio risk warning.
- [ ] Kết nối workflow runner với DataHub invalidate/refresh.
- [ ] Dùng `CronLog`/`Notification` hiện có nếu phù hợp, không tạo model trùng nếu chưa cần.

### 11.6. Acceptance criteria
- [ ] Chạy được ít nhất 3 workflow thật.
- [ ] Có execution log.
- [ ] Có retry/failure handling tối thiểu.
- [ ] Không phụ thuộc visual builder.

### 11.7. PR gợi ý
`feat(automation): add json-first workflow runtime`

---

## 12. Phase 7 — Hardening, logging, docs, cleanup

### 12.1. Mục tiêu
Ổn định hệ thống sau khi đã có DataHub + Workbench + Provider manifests + Broker topics + Workflow.

### 12.2. Việc phải làm
- [ ] Tạo logging thống nhất cho DataHub: cache hit/miss, producer latency, error count.
- [ ] Tạo market-hours aware refresh policy.
- [ ] Tuning TTL theo topic family.
- [ ] Viết docs: topic registry, producer contracts, workflow contracts.
- [ ] Dọn direct fetch dư thừa còn sót.
- [ ] Kiểm tra không còn component polling trùng responsibility với DataHub.
- [ ] Kiểm tra AI flows vẫn đi qua cache tables hiện có.

### 12.3. Acceptance criteria
- [ ] Có docs đủ để người khác tiếp tục code.
- [ ] Có log để debug stale/fetch/invalidation.
- [ ] Build/lint/schema validate pass.
- [ ] Không có regression obvious ở dashboard/stock/portfolio/backtest.

### 12.4. PR gợi ý
`chore(platform): harden datahub workflows and docs`

---

## 13. PR slicing khuyến nghị

Không nên làm một PR quá lớn. Nên chia như sau:

1. `docs/audit`
2. `datahub/core`
3. `datahub/api-hooks`
4. `migrate/dashboard-signalmap-rsrating`
5. `workbench/stock-page`
6. `providers/manifest-ui`
7. `broker/dnse-topics`
8. `automation/runtime`
9. `hardening/docs`

Mỗi PR phải:
- nhỏ vừa đủ review,
- có rollback path,
- không đổi public contract vô cớ.

---

## 14. Commands tối thiểu phải chạy sau mỗi phase

Trong repo web:

```bash
npm run lint
npm run build
npx prisma validate
```

Nếu có sửa DB schema:

```bash
npx prisma generate
```

Nếu có thay đổi Docker/runtime:

```bash
docker compose config
```

Nếu có local integration test cho bridge hoặc HTTP routes, chạy thêm theo thực tế workspace.

---

## 15. Checklist review bắt buộc cho mọi patch

Trước khi Codex kết thúc một phase, phải tự check:

- [ ] Patch này có giữ ADN là **web-first terminal** cho CK Việt Nam không?
- [ ] Có đang vô tình đẩy logic deterministic sang AI không?
- [ ] Có đang hardcode thứ đáng ra phải là manifest/topic contract không?
- [ ] Có reuse `fiinquantClient.ts`, `PriceCache.ts`, `UltimateSignalEngine.ts`, `SignalLifecycleWorker.ts`, `dnseClient.ts` đúng mức không?
- [ ] Có tạo thêm polling loop dư thừa không?
- [ ] Có làm tăng coupling giữa page và endpoint cụ thể không?
- [ ] Có TTL / invalidation / owner rõ ràng cho data mới không?
- [ ] Nếu bridge source thiếu, có document dependency thay vì bịa implementation không?

---

## 16. Prompt mẫu cho Codex — dùng tuần tự

### Prompt A — Audit
```text
Đọc ADN_FINCEPT_ARCHITECTURE.md, CHATBOT AI.md, CHANGELOG-SCANNER-V4.md, prisma/schema.prisma, src/app/api/bridge/[[...path]]/route.ts, src/lib/fiinquantClient.ts, src/lib/PriceCache.ts, src/lib/UltimateSignalEngine.ts, src/lib/SignalLifecycleWorker.ts, src/lib/dnseClient.ts và các page dashboard/stock/terminal/backtest/portfolio/signal-map/rs-rating.

Mục tiêu: tạo docs/implementation/current-state-audit.md map từng page -> data source -> cache -> candidate topic. Nếu local workspace khác public repo thì thêm docs/implementation/local-reality-notes.md. Không code feature mới ở bước này.
```

### Prompt B — DataHub core
```text
Dựa trên ADN_FINCEPT_ARCHITECTURE.md và ADN_FINCEPT_TASKLIST.md, hãy tạo DataHub foundation in-process cho Next.js:
- src/lib/datahub/types.ts
- src/lib/datahub/topic.ts
- src/lib/datahub/registry.ts
- src/lib/datahub/cache.ts
- src/lib/datahub/hub.ts
- src/lib/datahub/producers/base.ts
- src/lib/datahub/producers/marketProducer.ts
- src/lib/datahub/producers/newsProducer.ts
- src/lib/datahub/producers/signalProducer.ts
- src/hooks/useTopic.ts
- src/hooks/useTopics.ts
- src/app/api/hub/topic/[...topic]/route.ts
- src/app/api/hub/topics/route.ts
- src/app/api/hub/invalidate/route.ts

Yêu cầu:
- dedupe fetch cùng topic,
- TTL + minInterval,
- registry cho các topic VN index/news/signal/ta/fa/research/broker đầu tiên,
- response có metadata fresh/stale/fetchedAt/expiresAt/source/error,
- ưu tiên reuse fiinquantClient.ts,
- chưa thêm Redis/WebSocket.
```

### Prompt C — Migrate dashboard
```text
Refactor dashboard/page.tsx và nếu hợp lý cả signal-map/page.tsx, rs-rating/page.tsx để dùng useTopic/useTopics thay vì direct fetch rời rạc. Giữ UI gần như nguyên vẹn, chỉ đổi data orchestration layer. Nếu gặp polling loop thừa ở component con thì gom về DataHub.
```

### Prompt D — Research Workbench
```text
Refactor src/app/stock/[ticker]/page.tsx thành Ticker Research Workbench cho chứng khoán Việt Nam. Dùng topic aggregate research:workbench:{ticker}. Tạo shell + tabs cho Tổng quan, TA, FA, Tâm lý & Dòng tiền, News, Seasonality, Signal, Portfolio. Không để AI assemble final JSON; AI chỉ dùng qua cache/explanation flow hiện có.
```

### Prompt E — Provider manifests
```text
Refactor backtest/page.tsx sang manifest-driven UI. Tạo src/types/provider-manifest.ts và src/lib/providers/client.ts. Nếu local workspace có Python bridge source thì thêm provider registry/manifest/run contracts bên bridge; nếu không có thì chỉ tạo TS contracts, adapters, stub-safe fallback, và docs phụ thuộc bridge external. Không hardcode strategy list mới ở frontend.
```

### Prompt F — DNSE topics + portfolio merge
```text
Audit dnseClient.ts rồi tạo broker topic producers cho:
- broker:dnse:default:positions
- broker:dnse:default:orders
- broker:dnse:default:balance
- broker:dnse:default:holdings

Sau đó refactor portfolio/page.tsx để consume dữ liệu chuẩn hóa từ topics. Nếu cần thêm Prisma models cho snapshots thì tạo migration tối thiểu và không trùng model hiện có.
```

### Prompt G — Workflow runtime
```text
Tạo workflow automation runtime JSON-first dưới src/lib/automation với trigger/action schema cơ bản. Kết nối được với DataHub invalidate/refresh, Notification/CronLog nếu phù hợp, và tạo ít nhất 3 workflow mặc định: morning brief refresh, active signal change notification, portfolio risk warning.
```

---

## 17. Overall Definition of Success

Dự án được xem là đi đúng hướng khi đạt đủ các điều sau:

- [ ] Có **DataHub + Topic Registry** chạy thực tế.
- [ ] Ít nhất 3 page lớn đã topic-driven.
- [ ] `stock/[ticker]` trở thành **research workbench** chuẩn.
- [ ] `backtest` không còn phụ thuộc hoàn toàn vào hardcoded forms.
- [ ] Có **DNSE-first broker topics** dùng chung cho portfolio.
- [ ] Có **workflow automation runtime** ở mức JSON-first.
- [ ] AI vẫn chỉ là lớp explain/brief, không chiếm deterministic core.
- [ ] Hệ thống vẫn deploy được theo quy trình hiện tại.

---

## 18. Kết luận cho Codex

Đích đến của ADN không phải là một bản clone Fincept.

Đích đến là:
- **một terminal web-first cho chứng khoán Việt Nam**,
- có **data orchestration rõ ràng**,
- có **scanner/backtest mở rộng được**,
- có **research workspace theo từng mã**,
- có **broker context và workflow automation**,
- nhưng vẫn **giữ lõi deterministic, deploy đơn giản, và dễ vibe code tiếp**.

Khi phân vân giữa “làm nhanh cho chạy” và “giữ contract sạch”, hãy chọn phương án:
- chạy được,
- deploy được,
- nhưng vẫn giữ contract/topic/manifest rõ ràng.
