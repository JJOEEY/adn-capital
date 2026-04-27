# ADNexus Rebuild Audit

## 1. Scope
- Sprint này chỉ tối ưu UX/UI public web và app shell theo brand `ADNexus — Analyst. Discipline. Network.`
- Không đổi route, API, DataHub topic, Prisma schema, cron name, env key hoặc DNSE execution policy.
- `NexLink` vẫn là broker pilot/admin; không public real submit và không gọi DNSE runtime trên homepage.

## 2. Current Routes Map
- Public: `/`, `/san-pham`, `/pricing`, `/auth`, `/art`, `/rs-rating`, `/backtest`, `/hdsd`, `/journal`, `/terminal`.
- Authenticated app: `/dashboard`, `/dashboard/signal-map`, `/stock/[ticker]`, `/portfolio`, `/notifications`, `/menu`.
- Admin/pilot: `/dashboard/dnse-trading`, `/admin/*`.
- PWA/APK: dùng app shell hiện tại, bottom tab đã có `Nhật ký`; route nội bộ vẫn giữ nguyên.

## 3. Current Naming Map
- Platform: `ADNexus`.
- AI persona: `AIDEN`.
- Dashboard: `NexPulse`.
- Stock workbench: `NexLens`.
- Signal map: `NexRadar`.
- RS rating: `NexRank`.
- ART indicator: `NexART`.
- Risk layer: `NexGuard`.
- Portfolio: `NexVault`.
- Broker connect: `NexLink`.
- Broker workflow: `NexPilot`.
- Backtest: `NexLab`.
- Notifications: `NexSentinel`.
- Journal: `NexDiary`.

## 4. Display Rename Safe To Apply
- Nav labels, page headings, product cards, pricing copy, auth copy, sidebar labels and public marketing copy.
- Route display metadata can use new names while path remains unchanged.
- Internal identifiers must stay stable until a separate migration exists.

## 5. Public Pages Updated / Still Needing Attention
- `/`: has ADNexus scroll-story, product scenes, dropdown product nav and safety copy.
- `/san-pham`: now needs visual product hub, full product universe and subscription-aware NexRank locked state.
- `/pricing`: CTA must call PayOS checkout for logged-in users and redirect unauthenticated users to auth with plan.
- `/auth`: copy must not promise auto-trading; safe connected future state is allowed.
- `/art`, `/rs-rating`, `/backtest`, `/hdsd`, `/journal`: route names are retained; display naming should align with brand constants.

## 6. App Shell / Product Polish
- Sidebar should show `NexDiary` instead of “Nhật ký giao dịch”.
- `NexLink` remains hidden for non-admin users.
- Bottom nav keeps Vietnamese task labels where user-facing clarity is better, but product surfaces use Nex* names.

## 7. Animation And Scene Opportunities
- Homepage sections should be full viewport and full-bleed in feel, with internal reading width only for text.
- Product visuals should be CSS/SVG/components, not static screenshots.
- Motion should be reveal/fade/scale only; avoid heavy scroll-jacking and respect reduced-motion where possible.

## 8. Top 15 Remaining Gaps Compared With Bridgewise-Class Experience
1. Homepage sections were not full-bleed enough on wide screens.
2. Product universe missed `NexLens`, `NexRadar`, `NexGuard`, `NexVault`, `NexLink`, `NexLab`, `NexSentinel`.
3. `/san-pham` was text-card heavy and lacked visual context.
4. Pricing plan CTA linked to auth even when user was logged in.
5. Sidebar still used old “Nhật ký giao dịch” label.
6. Public copy still needed stricter removal of internal jargon.
7. Broker preview needed clearer “pilot / not auto-trading” language.
8. NexRank needed a visible locked/premium state in product hub.
9. Product dropdown needed deeper module links, not only broad navigation.
10. Product scenes needed richer context, not only mock cards.
11. Full-page scroll story needed desktop snap behavior.
12. FAQ was missing from the public product story.
13. Pricing teaser was missing from homepage flow.
14. Public page must avoid DNSE runtime calls.
15. Build and smoke validation must confirm no route is obviously broken.

## 9. Current Sprint Actions
- Expand public product story to all NexSuite modules.
- Add component-based scenes for each key module.
- Make `/san-pham` a visual product hub.
- Route logged-in pricing CTA through `POST /api/payment/create`.
- Rename sidebar journal label to `NexDiary`.
