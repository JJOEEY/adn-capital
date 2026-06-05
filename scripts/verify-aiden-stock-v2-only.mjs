import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const legacyNeedles = ["vn:fa", "research:workbench", "vn:historical", "vn:realtime"];

const forbiddenFiles = [
  "src/lib/aiden/stock-v2-chat.ts",
  "src/lib/database/aiden/context.ts",
];

let failed = false;

for (const file of forbiddenFiles) {
  const content = readFileSync(resolve(root, file), "utf8");
  for (const needle of legacyNeedles) {
    if (content.includes(needle)) {
      console.error(`[aiden-stock-v2-only] Legacy topic "${needle}" found in ${file}`);
      failed = true;
    }
  }
}

const context = readFileSync(resolve(root, "src/lib/database/aiden/context.ts"), "utf8");
if (!context.includes('"market.instruments"') || !context.includes('"reference.securities"')) {
  console.error("[aiden-stock-v2-only] Database v2 ticker universe allowlist is missing market.instruments/reference.securities");
  failed = true;
}

const route = readFileSync(resolve(root, "src/app/api/chat/route.ts"), "utf8");
const stockIndex = route.indexOf("runAidenStockChatV2Only");
const genericIndex = route.indexOf("runAidenDatahubChat({", stockIndex);

if (stockIndex < 0) {
  console.error("[aiden-stock-v2-only] /api/chat is not wired to runAidenStockChatV2Only");
  failed = true;
}

if (genericIndex < 0) {
  console.error("[aiden-stock-v2-only] /api/chat generic DataHub branch was not found after stock branch");
  failed = true;
}

const stockBranch = stockIndex >= 0 && genericIndex > stockIndex ? route.slice(stockIndex, genericIndex) : "";
for (const needle of legacyNeedles) {
  if (stockBranch.includes(needle)) {
    console.error(`[aiden-stock-v2-only] Legacy topic "${needle}" found in /api/chat stock branch`);
    failed = true;
  }
}

const stockChat = readFileSync(resolve(root, "src/lib/aiden/stock-v2-chat.ts"), "utf8");
if (stockChat.includes("runAidenDatahubChat") || stockChat.includes("getTopicEnvelope")) {
  console.error("[aiden-stock-v2-only] Stock v2 chat must not call generic DataHub chat/topic envelope");
  failed = true;
}

if (failed) process.exit(1);
console.log("[aiden-stock-v2-only] OK");
