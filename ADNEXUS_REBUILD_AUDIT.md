# ADNexus Rebuild Audit

## Scope
- Sprint hiện tại là display/UX rebuild cho public web và app shell, không đổi route/API/topic/DB/env.
- Brand hiển thị: `ADNexus - Analyst. Discipline. Network.`
- AI persona: `AIDEN`.
- DNSE/NexLink tiếp tục là pilot/admin; public homepage không gọi DNSE runtime và không hứa auto-trading.

## Current Routes Map
- `/`: public ADNexus scroll story.
- `/san-pham`, `/products`, `/products/[slug]`: product hub và product detail.
- `/pricing`: bảng giá, cần đi PayOS khi user đã login.
- `/auth`: đăng nhập/đăng ký, copy phải không hứa auto-trading.
- `/art`: NexART, không lộ công thức trên UI public/dashboard.
- `/rs-rating`: NexRank, chỉ Premium/VIP xem đầy đủ.
- `/terminal`: ADN Advisory powered by AIDEN.
- `/dashboard`: NexPulse authenticated command center.
- `/dashboard/signal-map`: NexPilot/NexRadar authenticated.
- `/dashboard/dnse-trading`: NexLink admin/pilot only.
- `/journal`: NexDiary.

## Naming Map
- Dashboard/Market Overview: NexPulse.
- Stock Workbench: NexLens.
- Signal Map: NexRadar.
- RS Rating: NexRank.
- ART Indicator: NexART.
- Risk/Guardrails: NexGuard.
- Portfolio: NexVault.
- DNSE/Broker Connect: NexLink.
- AI Broker/Broker Workflow: NexPilot.
- Backtest: NexLab.
- Notifications/Alerts: NexSentinel.
- Workflow Runtime: NexFlow.
- Tư vấn đầu tư: ADN Advisory powered by AIDEN, public short label `AIDEN Advisory`.

## Safe Display Rename
- Safe: nav labels, public copy, product cards, metadata, page headings, mock scenes.
- Not safe in this sprint: route paths, API paths, DataHub topics, Prisma models, cron names, env keys.

## Public Pages Updated
- `/` now uses full-viewport scroll story sections, fixed header, motion frame, product universe, FAQ schema and safety copy.
- `/products` now has visual product hub instead of text-only cards.
- `/products/[slug]` has metadata, structured data, product scene, safety principle block.
- Public header product menu opens on hover/focus and links to section anchors/product pages.

## App Pages Requiring Continued Polish
- PWA/app shell already has native-first navigation work, but authenticated dashboards still need visual unification in later UI polish.
- NexLink remains hidden for non-admin until pilot is approved for public release.

## Motion Opportunities Implemented
- Fixed top header with gradient motion frame.
- Full-viewport story sections.
- Lightweight CSS/SVG-like scenes.
- Reduced-motion fallback in global CSS.
- No fake count-up KPI or hidden stale state.

## Top 15 Gaps vs Bridgewise-Class Experience
1. Full-bleed public sections were too boxed - addressed in `HomePageV2`.
2. Product menu required click - addressed with hover/focus.
3. Header was not fixed - addressed in `PublicSiteHeader`.
4. Motion rules were undocumented - addressed in sprint notes and CSS reduced-motion rules.
5. SEO metadata incomplete - addressed in root/products/product detail metadata.
6. Product universe missing modules - addressed through `nexsuite.ts`.
7. `/san-pham` lacked visual product context - partially addressed by `/products`; `/san-pham` should remain aligned.
8. Public copy had jargon risk - reduced in homepage/product copy.
9. NexLink public ambiguity - clarified as pilot/admin, no DNSE runtime call on public.
10. AIDEN Advisory naming was inconsistent - public short label added.
11. Service worker could serve stale deploy - cache bumped and `SKIP_WAITING` added.
12. Sprint 0-6 traceability missing - addressed with sprint notes.
13. Product detail pages lacked structured data - addressed.
14. Auth/pricing still need ongoing copy/PayOS validation - tracked in notes.
15. Browser visual smoke still required after deploy - tracked in QA notes.
