import fs from "node:fs";
import path from "node:path";

const files = [
  "src/app/layout.tsx",
  "src/app/dashboard/page.tsx",
  "src/app/admin/page.tsx",
  "src/app/menu/page.tsx",
  "src/app/notifications/page.tsx",
  "src/app/terminal/page.tsx",
  "src/app/stock/[ticker]/page.tsx",
  "src/app/products/page.tsx",
  "src/app/products/[slug]/page.tsx",
  "src/app/tin-tuc/page.tsx",
  "src/app/tin-tuc/[slug]/page.tsx",
  "src/app/api/articles/route.ts",
  "src/app/api/articles/by-slug/[slug]/route.ts",
  "src/app/api/internal/openclaw/articles/route.ts",
  "src/components/layout/Header.tsx",
  "src/components/layout/AppHeader.tsx",
  "src/components/news/ArticleDetailClient.tsx",
  "src/components/pwa/BottomTabBar.tsx",
  "src/components/chat/InvestmentChat.tsx",
  "src/components/chat/StockChart.tsx",
  "src/components/adnexus/ProductModuleCard.tsx",
  "src/components/adnexus/ProductScenes.tsx",
  "src/components/adnexus/PublicSiteFooter.tsx",
  "src/components/adnexus/PublicSiteHeader.tsx",
  "src/lib/brand/nexsuite.ts",
  "src/lib/brand/productNames.ts",
  "src/lib/articles/image-fallback.ts",
  "src/lib/articles/server.ts",
];

const suspiciousFragments = [
  ["latin1-C3", "\u00c3"],
  ["latin1-C4", "\u00c4"],
  ["latin1-C6", "\u00c6"],
  ["vietnamese-mojibake-a-ba", "\u00e1\u00ba"],
  ["vietnamese-mojibake-a-bb", "\u00e1\u00bb"],
  ["windows-punctuation-mojibake", "\u00e2\u20ac"],
  ["nbsp-mojibake", "\u00c2 "],
  ["copyright-mojibake", "\u00c2\u00a9"],
  ["replacement-character", "\ufffd"],
  ["replacement-character-mojibake", "\u00ef\u00bf\u00bd"],
];

const issues = [];

for (const rel of files) {
  const abs = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(abs)) continue;
  const content = fs.readFileSync(abs, "utf8");

  for (const [label, fragment] of suspiciousFragments) {
    if (!content.includes(fragment)) continue;
    issues.push(`${rel}: matched ${label}`);
  }
}

if (issues.length > 0) {
  console.error("[encoding-check] Mojibake detected:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("[encoding-check] OK");
