# Phase 5.1/5.2 — DNSE Execution Adapter (Staging-Safe)

## 1) Execution Mode
- Current mode: `SAFE_EXECUTION_ADAPTER_MODE`
- Real order submit: `OFF` by default
- Manual token mode: `OFF` by default
- Compliance gate: `DNSE_COMPLIANCE_APPROVED_FLOW=false` by default

## 2) Why SAFE mode is mandatory now
- Workspace chưa có flow OTP/Trading-Token cho end-user đã được compliance approve.
- Vì vậy execution phải giữ deterministic gate + human confirmation, và chỉ cho phép staging-safe verification.
- Không fake trạng thái thành công khi điều kiện submit thật chưa đủ.

## 3) What is shipped
- Deterministic contracts:
  - `OrderIntent`
  - `OrderValidationResult`
  - `OrderExecutionPreview`
  - `DnseExecutionRequest`
  - `DnseExecutionResult`
  - `OrderTicket`
- Canonical APIs:
  - `POST /api/v1/brokers/dnse/order-intents/parse`
  - `POST /api/v1/brokers/dnse/order-intents/validate`
  - `POST /api/v1/brokers/dnse/orders/preview`
  - `POST /api/v1/brokers/dnse/orders/submit`
- Human confirmation is required:
  - `previewId`
  - `confirm=true`
  - `confirmationText=CONFIRM`
- Deterministic gate coverage:
  - required fields
  - ticker/account checks
  - order type/price/quantity validation
  - max notional guard
  - replay cooldown + idempotency
  - trading-session warning
- Audit trail:
  - `Changelog(component=DNSE_EXECUTION)` lưu parse/validate/preview/submit events
- DataHub broker topics:
  - canonical v2:
    - `broker:dnse:{userId}:{accountId}:positions`
    - `broker:dnse:{userId}:{accountId}:orders`
    - `broker:dnse:{userId}:{accountId}:balance`
    - `broker:dnse:{userId}:{accountId}:holdings`
  - compatibility aliases:
    - `broker:dnse:{accountId}:{channel}`
    - `broker:dnse:current-user:{channel}`
- UI tối thiểu:
  - `OrderTicketPanel` trên `stock/[ticker]` để parse/preview/confirm submit

## 4) Feature flags
- `DNSE_EXECUTION_MODE=SAFE_EXECUTION_ADAPTER_MODE`
- `DNSE_ORDER_INTENT_ENABLED=true`
- `DNSE_ORDER_PREVIEW_ENABLED=true`
- `DNSE_REAL_ORDER_SUBMIT_ENABLED=false`
- `DNSE_MANUAL_TEST_TOKEN_MODE=false`
- `DNSE_COMPLIANCE_APPROVED_FLOW=false`
- `DNSE_ALLOW_REAL_SUBMIT_IN_PROD=false`
- `DNSE_ALLOW_MANUAL_TEST_IN_PROD=false`
- Optional:
  - `DNSE_MAX_ORDER_NOTIONAL`
  - `DNSE_ORDER_REPLAY_COOLDOWN_MS`

## 5) Hard guards
- Real submit chỉ bật khi đồng thời đúng các điều kiện:
  - `DNSE_REAL_ORDER_SUBMIT_ENABLED=true`
  - `DNSE_COMPLIANCE_APPROVED_FLOW=true`
  - nếu production: `DNSE_ALLOW_REAL_SUBMIT_IN_PROD=true`
- Manual token mode chỉ bật khi:
  - `DNSE_MANUAL_TEST_TOKEN_MODE=true`
  - nếu production: `DNSE_ALLOW_MANUAL_TEST_IN_PROD=true`
- Nếu không đủ điều kiện:
  - `blocked_not_enabled` hoặc `approval_required`
  - không có giả lập `accepted`

## 6) Phase 5.2 staging verification scope
- Staging-safe end-to-end cần verify:
  - auth/session pass
  - parse -> validate -> preview -> submit(safe-mode)
  - submit trả `blocked_not_enabled` hoặc `approval_required` đúng contract
  - audit trail được ghi đầy đủ
  - broker topics hydrate đúng `source/freshness/error`
- Debug/read-model endpoint:
  - `GET /api/admin/system/dnse-execution`
- Debug view:
  - `/admin/dnse-execution`
- Runtime validator:
  - `npm run verify:phase5:runtime`
  - báo rõ: DB env, auth env, safe flags, DNSE-linked account readiness, blockers.

## 7) Known blockers
- Nếu chưa có compliance-approved OTP/trading-token flow:
  - bắt buộc giữ safe-gated mode
  - không mở real submit công khai
- Nếu thiếu runtime dependencies (DB/auth/env hoặc user DNSE verified):
  - không thể kết luận staging verified
  - phải trả verdict `PHASE5_2_BLOCKED_BY_RUNTIME` hoặc `PHASE5_2_BLOCKED_BY_COMPLIANCE`
