# ADN SEO Machine

Status: operational guide
Owner: web/content
Scope: public website SEO, news/research articles, landing pages

## Why This Exists

SEO Machine is a content workflow, not an app dependency. ADN should use its ideas as a repeatable publishing system:

1. Research the keyword and search intent before writing.
2. Write with ADN's finance/investing voice and source discipline.
3. Optimize metadata, headings, internal links, media, and schema before publish.
4. Refresh old content based on traffic, ranking, and market relevance.

## ADN Source Rules

- Do not invent deterministic trading signals, win rates, market scores, or broker behavior.
- Signals, scanner output, DataHub topics, backtest numbers, and broker execution policy must come from canonical runtime/data artifacts.
- Articles can explain, summarize, educate, and compare. They must not promise profit or imply guaranteed returns.
- Market claims need a source URL, report, DataHub artifact, or clearly labeled ADN analysis basis.
- Include risk language when content discusses trading, signals, margin, or portfolio allocation.

## Target Keyword Clusters

Primary commercial/product clusters:

- he thong phan tich chung khoan AI
- tin hieu giao dich chung khoan
- RS Rating chung khoan
- phan tich ky thuat VNINDEX
- ban do dong tien chung khoan
- backtest chien luoc chung khoan
- quan tri rui ro danh muc

Educational clusters:

- cach doc tin hieu mua ban co phieu
- cach quan tri rui ro khi dau tu chung khoan
- VNINDEX hom nay nen lam gi
- thanh khoan thi truong la gi
- suc manh gia RS Rating la gi

News/research clusters:

- tin tuc chung khoan hom nay
- bao cao phan tich co phieu
- thi truong chung khoan Viet Nam
- dong tien nuoc ngoai
- co phieu manh hon thi truong

## Internal Link Map

Use these links naturally inside articles:

- `/` - ADN Capital platform overview.
- `/san-pham` - Product capabilities: AI analysis, RS Rating, signal map, backtest.
- `/pricing` - Plans and access tiers.
- `/khac/tin-tuc` - News and research hub.
- `/backtest` - Strategy verification and historical performance context.
- `/rs-rating` - Relative strength ranking context.
- `/signal-map` - Market signal and opportunity map.
- `/art` - ADN Composite/market timing context.
- `/hdsd` - User guidance and onboarding.

Each article should include 3-5 relevant internal links. Prefer deep links over homepage links.

## Article Structure

Use this default structure for evergreen SEO content:

1. H1: include the primary keyword naturally.
2. First 1-2 sentences: answer the search query directly.
3. Key takeaways block: 3-5 concrete bullets.
4. 4-7 H2 sections, each focused on one idea.
5. Examples using Vietnamese market context when relevant.
6. FAQ section with 4-6 natural-language questions.
7. Conclusion with one clear next step and risk reminder.

For news articles:

- Keep the title specific and timely.
- Lead with the market impact in the first paragraph.
- Link to original source/report when available.
- Add ADN analysis only when the basis is explicit.

## Metadata Rules

- Meta title: target 50-60 characters, include the primary keyword.
- Meta description: target 140-160 characters, answer the query and explain why the page is useful.
- Slug: short, lowercase, hyphenated, keyword-focused.
- Image alt text: describe the image and include the topic only when natural.
- Article pages must expose Article/NewsArticle JSON-LD, canonical URL, Open Graph title/description/image, and publish/update dates.

## Publishing Checklist

Before publishing:

- One H1 only.
- Clear H2/H3 hierarchy.
- Primary keyword in title, intro, at least one H2, and conclusion.
- 3-5 internal links.
- 2+ authoritative external links for factual claims.
- No unsupported performance promises.
- Published date and named author visible.
- Featured image has useful alt text.
- Meta title and description are unique.
- Article is included in `/sitemap.xml`.

## Refresh Triggers

Refresh an article when:

- It is older than 90 days and tied to market conditions.
- It is older than 12 months and evergreen.
- Source data, rules, product UI, or pricing changed.
- Search Console shows declining clicks/impressions.
- A newer ADN feature should become an internal link target.

## Sources Behind This Adaptation

- SEO Machine workflow: https://github.com/TheCraigHewitt/seomachine
- Next.js metadata, sitemap, and robots conventions: https://nextjs.org/docs/15/app/getting-started/metadata-and-og-images
- Google Article structured data: https://developers.google.com/search/docs/appearance/structured-data/article
- Google Organization structured data: https://developers.google.com/search/docs/appearance/structured-data/organization
