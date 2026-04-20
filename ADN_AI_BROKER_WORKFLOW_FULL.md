# ADN AI Broker - Full Workflow (Code-Driven)

> Superseded notice (Phase 7):
> - Canonical runtime contract for cron/env/deploy is maintained in:
>   - `docs/ops/SOURCE_OF_TRUTH.md`
>   - `docs/architecture/ADN_MASTER_ARCHITECTURE.md`
> - Legacy cron aliases in this document (`signal_scan_5m`, `intraday`, `prop_trading`) are compatibility-only.
> - Canonical cron names are:
>   - `signal_scan_type1`
>   - `market_stats_type2`
>   - `morning_brief`
>   - `close_brief_15h`
>   - `eod_full_19h`

## 1. Scope va phien ban du an

Tai lieu nay mo ta workflow van hanh thuc te cua **ADN AI Broker** dua tren code hien tai tai local project `D:\BOT\adn-ai-bot` (dong bo voi `origin/master`).

Phan mo ta bao gom:
- Luong nguoi dung (chat + widget + signal map).
- Luong scan tin hieu, lifecycle, notification.
- Luong quan tri (Admin settings, force ACTIVE, quota, entitlement).
- Luong phan quyen/goi cuoc/chat quota.
- Luong cron tu dong va tich hop voi Python FiinQuant bridge.

Khong chi la mo ta UX, tai lieu nay map truc tiep den API route + service + database.

---

## 2. Kien truc tong quan ADN AI Broker

### 2.1 Cac khoi he thong

1. **Frontend Next.js App Router**
- Dashboard Signal Map: `/dashboard/signal-map`
- Terminal chat: `/terminal`
- Notifications feed + chatbot tab: `/notifications`
- Admin panel: `/admin`

2. **Backend API (Next.js route handlers)**
- Chat engine: `/api/chat`, `/api/chat/history`
- Signal engine: `/api/scan-now`, `/api/signals`, `/api/webhooks/signals`
- Lifecycle worker: `/api/cron/signal-lifecycle`
- Cron dispatcher: `/api/cron?...`
- Admin controls: `/api/admin/...`

3. **Data layer**
- PostgreSQL + Prisma
- Bang cot loi: `User`, `Signal`, `Chat`, `Notification`, `ChatUsageDaily`, `AdminChatQuotaOverride`, `SystemSetting`, `SignalHistory`, `TradingJournal`, `PaymentOrder`, `AdminEntitlementGrant`, `AiInsightCache`.

4. **External integrations**
- **Google Gemini** (chat + ai reasoning)
- **FiinQuant/Python bridge** (`/api/v1/...`) cho scanner, market data, TA summary, FA, TEI, RPI.
- **VNDirect dchart API** (TA fallback trong `stockData.ts`)
- **PayOS** (thanh toan)
- **Web Push** (PWA notifications)

---

## 3. Luong dang nhap, phan quyen, goi cuoc

### 3.1 Auth

- NextAuth v5 (Google + Credentials) trong `src/lib/auth.ts`.
- Middleware bao ve `/dashboard/*` (`src/middleware.ts`).
- User profile runtime lay qua `/api/me`.

### 3.2 Entitlement logic

He thong dung 2 lop quyen:
- `systemRole`: `ADMIN | USER` (quyen quan tri).
- Entitlement badge: `FREE | VIP | PREMIUM` (quyen san pham/chat).

Nguon entitlement:
1. Grant append-only (`AdminEntitlementGrant`) uu tien cao nhat.
2. Fallback legacy (`role` + `vipUntil`).

Ham chinh:
- `resolveEffectiveEntitlement`
- `reconcileUserEntitlementState`

### 3.3 Chat quota logic

`src/lib/chat-quota.ts`:
- Guest: 3 luot.
- FREE: 5 luot/ngay.
- VIP theo plan:
  - `1m`: 20 luot/ngay
  - `3m`: 30 luot/ngay
  - plan khac: unlimited
- PREMIUM: unlimited.
- Admin override co the chuyen sang che do package tron doi (`AdminChatQuotaOverride`).

Moi request chat deu:
1. `resolveChatQuota`
2. neu het luot -> tra 429 `LIMIT_REACHED`
3. thanh cong -> `consumeChatQuota`

---

## 4. Workflow nguoi dung voi ADN AI Broker Chat

## 4.1 Entry points

Nguoi dung vao chat tu:
- `/terminal` (chat chinh)
- tab chatbot trong `/notifications`
- cac flow lien quan ma co phieu

Frontend component chinh: `InvestmentChat.tsx`

### 4.2 Luong ticker interceptor (quan trong nhat)

Khi user gui tin nhan den `/api/chat`, backend chay **Ticker Interceptor** truoc:

1. Parse command va detect intent.
2. Neu la ticker don hoac cau phan tich 1 ma:
- Khong cho LLM quyet dinh format.
- Backend tra response type `widget` theo contract co dinh.
3. Lay full widget data tu `getFullWidgetData(ticker)` gom 4 tab:
- Technical
- Fundamental
- Behavior
- News
4. Luu chat history dang marker `[WIDGET:...]`.
5. Consume quota.

Khi `IS_MOCK_MODE=true`, he thong tra mock widget tu `MockFactory`.

### 4.3 Luong command chat

Neu khong vao widget interceptor, he thong xu ly command:
- `/ta TICKER`
- `/fa TICKER`
- `/news TICKER`
- `/tamly TICKER`
- `/compare T1 T2 ...`

Co bo prompt rieng cho tung intent va enforcing anti-hallucination (`RAG_RULES`).

### 4.4 Luong general free-text

Neu la chat tu do:
1. He thong detect co can market context hay khong.
2. Neu can -> fetch market overview + VNINDEX TA + TA cua cac ticker detect duoc.
3. Neu user dua premise gia sai lech > 3% so voi data realtime -> tu choi phan tich tren premise sai.
4. Goi Gemini intent `GENERAL`.
5. Auto append disclaimer bat buoc.

### 4.5 Nguon context bo sung cho chat

Truoc khi goi AI, he thong lap context:
- Knowledge base (`ChatKnowledge`, cache 5 phut)
- Recent chat history (6 messages)
- Ho so giao dich (`TradingJournal`) de ca nhan hoa
- Signal context cua ticker trong 24h

### 4.6 Luu lich su chat

- User login: luu cap user/assistant vao bang `Chat`.
- Endpoint history: `/api/chat/history`
- Marker widget duoc parse nguoc thanh `widgetMeta` de UI render chart/badge dung.

---

## 5. Workflow Widget 4 tab (Ticker Dashboard)

Service: `src/lib/widget-service.ts`

Nguyen tac:
1. Fetch real data truoc.
2. AI chi viet text insight, khong duoc sinh JSON schema.
3. TypeScript la ben lap final widget shape.

### 5.1 Tab PTKT
- Data: bridge `/api/v1/ta-summary/{ticker}`
- Insight cache DB (`AiInsightCache`, tab `PTKT`, TTL 1 ngay)
- Neu co cache hop le: dung lai insight, van lay data moi

### 5.2 Tab PTCB
- Data: `fetchFAData` (FiinQuant fundamental)
- Smart quarter fallback Q-1 -> Q-3 neu quy hien tai thieu data
- Insight cache DB (`PTCB`, TTL 90 ngay)

### 5.3 Tab Behavior
- Data TEI tu `/api/v1/rpi/{ticker}` (thu Today -> T-1 -> T-2)
- AI tao nhan dinh tam ly ngan gon

### 5.4 Tab News
- Thu crawl CafeF
- Neu khong co: fallback deterministic headlines
- AI tom tat headline + action note

---

## 6. Workflow ADN AI Broker Signal Engine

Signal Engine co 3 lop:
1. Scan ra candidate
2. Process qua UltimateSignalEngine
3. Theo doi lifecycle den khi dong lenh

### 6.1 Nguon scan

Co 3 duong vao:
- Manual tu UI: `POST /api/scan-now`
- Cron: `GET /api/cron?type=signal_scan_5m` hoac `/api/cron/scan-signals`
- Webhook scanner: `POST /api/webhooks/signals`

Tat ca cuoi cung deu su dung `processSignals()`.

### 6.2 UltimateSignalEngine

`src/lib/UltimateSignalEngine.ts`:

Step 1 - Map tier:
- `SIEU_CO_PHIEU -> LEADER`
- `TRUNG_HAN -> TRUNG_HAN`
- `DAU_CO -> NGAN_HAN`
- `TAM_NGAM -> TAM_NGAM`

Step 2 - Seasonality:
- Batch fetch seasonality
- NodeCache theo key `ticker:YYYY-MM`, TTL 30 ngay
- Dieu chinh NAV:
  - WR > 70% -> x1.2
  - WR < 40% -> x0.5

Step 3 - AI reasoning:
- Goi Gemini de tao card ly do vao lenh
- Kem checklist ky thuat
- Ket qua dung de hien thi tren signal card

Output signal luu vao DB voi:
- `status=RADAR` (hoac ACTIVE neu auto-pick pass)
- `entryPrice`, `target` (nguong canh bao), `stoploss`, `rrRatio`, `navAllocation`, `winRate`, `sharpeRatio`, `aiReasoning`.

### 6.3 Auto-pick ACTIVE

`src/lib/aiBroker.ts` + setting runtime:
- `AI_BROKER_MIN_PRICE`
- `AI_BROKER_MIN_WINRATE`
- `AI_BROKER_MIN_RR`
- `AI_BROKER_AUTO_PICK`
- `AI_BROKER_MAX_TOTAL_NAV`

Signal co the duoc day RADAR -> ACTIVE neu qua dieu kien auto-pick.

### 6.4 Lifecycle Worker

`updateSignalLifecycle()` chay cron 5 phut:

Trang thai va transition:
1. `RADAR -> ACTIVE`
- Neu autoActivate dat dieu kien
- Hoac fallback breakout (thieu metric AI ma gia >= entry)

2. `ACTIVE`
- Neu pnl >= 20% -> `HOLD_TO_DIE` + trailing stop bac thang
- Neu gia <= stoploss -> `CLOSED` (cat lo)
- Neu AI exit scan bao shouldExit -> `CLOSED`
- Neu cham nguong alert (target) -> chi alert, khong dong lenh

3. `HOLD_TO_DIE`
- Doi SL len theo moc 10%
- Gia cham trailing SL -> `CLOSED`
- Hoac TEI >= 4.5 -> `CLOSED` (chot loi chu dong)

Cuoi moi vong lifecycle:
- `rebalanceActiveBasketNav(maxTotalNav)` de tong NAV gio ACTIVE khong vuot nguong.

---

## 7. Workflow Signal Map cho nguoi dung

Trang: `/dashboard/signal-map`

### 7.1 Dieu kien truy cap
- Chua login -> redirect `/auth`
- FREE -> thay `UpgradeVIP`
- VIP/PREMIUM/Admin -> mo SignalMap

### 7.2 Du lieu hien thi
- Goi `/api/signals?days=90`
- Chia tab:
  - `RADAR` (tam ngam)
  - `ACTIVE` (dang nam giu)
  - `CLOSED` (vip/premium)

### 7.3 Refresh thu cong
- Nut "Lam moi" -> goi `POST /api/scan-now`
- Sau do mutate SWR de cap nhat map

---

## 8. Workflow Notification va ban tin tu dong

### 8.1 Tao notification

`pushNotification(type,title,content)` se:
1. Luu DB (`Notification`)
2. Gui web-push cho subscribers
3. Tu xoa subscription het han (410)

### 8.2 Nguon phat sinh notification

1. **Signal moi** tu cron/webhook scan
- Dedupe bang `SignalHistory` theo `ticker + signalType + sentDate`
- Gan window type theo gio VN (`signal_10h`, `signal_1130`, `signal_14h`, `signal_1445`)

2. **Intraday reports** (`/api/cron?type=intraday`)
- 10:00, 11:30, 14:00, 14:45
- Co fallback neu Gemini/data loi

3. **EOD full 19:00** (`type=prop_trading`)
- Tong hop khoi ngoai + tu doanh + ca nhan + thanh khoan

4. **AI weekly review** (17:00 Thu 6)
- Quet user `enableAIReview=true`
- Sinh danh gia tam ly 1-1
- Luu private notification (`userId` != null)

### 8.3 Hien thi feed notification
- API `/api/notifications`
- Guest: chi thay global
- User login: thay global + private cua chinh minh

---

## 9. Workflow Admin dieu phoi ADN AI Broker

### 9.1 Runtime settings

API: `/api/admin/settings`

Admin co the doi realtime:
- `IS_MOCK_MODE`
- `AI_BROKER_MIN_PRICE`
- `AI_BROKER_MIN_WINRATE`
- `AI_BROKER_MIN_RR`
- `AI_BROKER_AUTO_PICK`
- `AI_BROKER_MAX_TOTAL_NAV`

Moi thay doi duoc audit vao `Changelog`.

### 9.2 Force activate thu cong

API: `/api/admin/ai-broker/activate`

Admin nhap ticker + navAllocation:
1. Tim signal RADAR/ACTIVE moi nhat cua ticker
2. Ep `status=ACTIVE`
3. Rebalance gio ACTIVE
4. Luu audit changelog

### 9.3 Quan ly user va quota

- `/api/admin/users`
- `/api/admin/users/[id]`
- `/api/admin/users/[id]/chat-quota`
- `/api/admin/users/[id]/entitlements`

Admin co the:
- Grant/revoke `VIP/PREMIUM`
- Set package quota override
- Nang quyen system role

### 9.4 Monitor cron health

API: `/api/admin/system/cron-status`
- Kiem tra lan scan gan nhat
- Bao stale neu trong gio giao dich ma qua lau chua chay

---

## 10. Workflow thanh toan va nang cap goi

1. User tao payment link (PayOS).
2. Webhook PayOS thanh cong:
- update `PaymentOrder` -> `PAID`
- update user `role=VIP`, gia han `vipUntil`
3. Entitlement resolver se hop nhat role/quyen khi user call `/api/me` hoac login tiep theo.

Luu y: grant admin (`AdminEntitlementGrant`) van co uu tien cao hon legacy role/vipUntil.

---

## 11. Scheduler / Cron lich chay thuc te

Theo `vercel.json`:
- 08:00 VN: morning report
- 10:00, 11:30, 14:00, 14:45 VN: intraday
- 15:00 VN: afternoon review
- 19:00 VN: prop trading report
- Signal scan slots: 10:00, 10:30, 11:30, 14:00, 14:45
- 17:00 Thu 6: AI weekly review

---

## 12. Fail-safe va fallback quan trong

1. Chat:
- Neu bridge AI loi -> fallback Gemini local
- Neu Gemini timeout (news/tamly) -> fallback deterministic
- Co anti-premise-mismatch de tranh phan tich tren gia sai

2. Widget:
- Neu data tab loi -> tra placeholder an toan, khong vo contract UI

3. Signal:
- Dedupe theo ticker+type trong ngay
- Khong gui notification trung nhan `SignalHistory`

4. Cron report:
- Neu AI loi -> dung fallback message
- Moi lan chay duoc log vao `CronLog`

5. Settings:
- Runtime cache 10s, update khong can restart server

---

## 13. So do workflow tong hop

```text
Nguoi dung/cron/webhook
    |
    +--> /api/chat ------------------------------+
    |        |                                   |
    |        +--> ticker interceptor -> widget   |
    |        +--> command/general -> Gemini      |
    |        +--> quota check + consume          |
    |        +--> save Chat history              |
    |                                            |
    +--> /api/scan-now or /api/cron scan --------+--> processSignals(UltimateSignalEngine)
    |                                                   |
    |                                                   +--> upsert Signal (RADAR/ACTIVE)
    |                                                   +--> rebalance NAV
    |                                                   +--> push Notification (+ SignalHistory dedupe)
    |
    +--> /api/cron/signal-lifecycle --> updateSignalLifecycle
                                                        |
                                                        +--> RADAR->ACTIVE
                                                        +--> ACTIVE->HOLD_TO_DIE/CLOSED
                                                        +--> HOLD_TO_DIE trailing + TEI exit
                                                        +--> rebalance NAV
```

---

## 14. Danh sach endpoint cot loi ADN AI Broker

### Chat + widget
- `POST /api/chat`
- `GET|POST /api/chat/history`

### Signals
- `GET|PATCH /api/signals`
- `POST /api/scan-now`
- `POST /api/webhooks/signals`
- `GET /api/cron/signal-lifecycle`

### Cron reports
- `GET /api/cron?type=intraday`
- `GET /api/cron?type=prop_trading`
- `GET /api/cron?type=signal_scan_5m`
- `GET /api/cron/ai-weekly-review`

### Admin
- `GET|POST /api/admin/settings`
- `POST /api/admin/ai-broker/activate`
- `GET /api/admin/system/cron-status`
- `GET /api/admin/users`
- `PATCH /api/admin/users/[id]`
- `GET|POST|DELETE /api/admin/users/[id]/chat-quota`
- `GET|POST /api/admin/users/[id]/entitlements`

### User/profile/quota
- `GET /api/me`

---

## 15. Ket luan nhanh

ADN AI Broker hien tai la he thong lai (hybrid):
- **Real-time data pipeline** (FiinQuant/Python/VNDirect)
- **AI reasoning layer** (Gemini, intent-based)
- **Rule-based risk engine** (tier, auto-pick, trailing stop, quota)
- **Operational control layer** (admin runtime settings, force activate, cron health)

Noi dung tren la workflow thuc te theo code, co the dung lam tai lieu van hanh/kiem thu/UAT cho toan bo module ADN AI Broker.
