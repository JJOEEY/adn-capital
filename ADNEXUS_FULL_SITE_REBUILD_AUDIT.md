# ADNexus Full Site Rebuild Audit

## Sprint 0 Status
- Source of truth confirmed: `src/lib/brand/productNames.ts` and `src/lib/brand/nexsuite.ts`.
- Routes remain stable; only display names and public UX changed.
- Public DNSE/NexLink remains non-runtime, pilot/admin only.

## Main Risks Found
- Browser/service worker cache can show the previous deploy after F5.
- Public copy must avoid internal jargon: DataHub, upsert, phiếu lệnh, guardrail.
- Product storytelling must stay full-bleed and section-based instead of card-only.

## Controls Added
- Service worker cache version bumped and waiting worker skips immediately.
- Header fixed with motion frame and hover/focus product dropdown.
- SEO/metadata and JSON-LD added for root/products/product detail surfaces.
