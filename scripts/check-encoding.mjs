import fs from "node:fs";
import path from "node:path";

const files = [
  "src/app/layout.tsx",
  "src/app/dashboard/page.tsx",
  "src/app/admin/page.tsx",
  "src/app/menu/page.tsx",
  "src/app/notifications/page.tsx",
  "src/components/layout/Header.tsx",
  "src/components/layout/AppHeader.tsx",
  "src/components/pwa/BottomTabBar.tsx",
];

const patterns = [
  /Tá»/g,
  /LÃ/g,
  /thá»‹ trÆ°/g,
  /ï¿½/g,
];

const issues = [];

for (const rel of files) {
  const abs = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(abs)) continue;
  const content = fs.readFileSync(abs, "utf8");

  for (const pattern of patterns) {
    if (!pattern.test(content)) continue;
    issues.push(`${rel}: matched ${pattern}`);
    pattern.lastIndex = 0;
  }
}

if (issues.length > 0) {
  console.error("[encoding-check] Mojibake detected:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("[encoding-check] OK");
