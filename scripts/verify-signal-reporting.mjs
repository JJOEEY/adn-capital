import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function transpileTsModule(relPath) {
  const source = read(relPath);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require(id) {
      throw new Error(`Unexpected require(${id}) while verifying ${relPath}`);
    },
    console,
  };
  vm.runInNewContext(output, sandbox, { filename: relPath });
  return module.exports;
}

const reporting = transpileTsModule("src/lib/signals/reporting.ts");

const candidates = [
  { ticker: " gvr ", type: "DAU_CO", entryPrice: 33700 },
  { ticker: "VRE", type: "DAU_CO", entryPrice: 32300 },
  { ticker: "VRE", type: "DAU_CO", entryPrice: 32300 },
  { ticker: "PNJ", type: "DAU_CO", entryPrice: 67300 },
];

const history = [
  { ticker: "GVR", signalType: "DAU_CO", sentDate: "2026-04-30", createdAt: "2026-04-30T03:34:00.000Z" },
  { ticker: "AAA", signalType: "DAU_CO", sentDate: "2026-04-29", createdAt: "2026-04-29T03:34:00.000Z" },
];

const freshTickers = [...reporting.selectFreshSignalCandidates(candidates, history, "2026-04-30").map((item) => item.ticker)];
assert.deepEqual(freshTickers, ["VRE", "PNJ"], "fresh selection must remove already reported tickers and duplicate candidates");

const summary = reporting.buildReportedSignalSummary(
  [
    { ticker: "GVR", signalType: "DAU_CO", sentDate: "2026-04-30", createdAt: "2026-04-30T03:34:00.000Z" },
    { ticker: "VRE", signalType: "DAU_CO", sentDate: "2026-04-30", createdAt: "2026-04-30T04:31:00.000Z" },
    { ticker: "GVR", signalType: "DAU_CO", sentDate: "2026-04-30", createdAt: "2026-04-30T03:34:00.000Z" },
  ],
  "2026-04-30",
);

assert.equal(summary.total, 2, "summary must dedupe persisted report history");
assert.deepEqual([...summary.tickers], ["VRE", "GVR"], "summary must keep newest reported tickers first");
assert.equal(summary.groups[0].signalType, "DAU_CO");
assert.deepEqual([...summary.groups[0].tickers], ["VRE", "GVR"]);

const formatted = reporting.formatReportedSignalSummary(summary, { limit: 5 });
assert.match(formatted, /2026-04-30/);
assert.match(formatted, /VRE/);
assert.match(formatted, /GVR/);

const datahubRegistry = read("src/lib/datahub/registry.ts");
assert.match(datahubRegistry, /signal:reported:today/, "DataHub must expose today's reported signals");
assert.match(datahubRegistry, /signal:reported:\{date\}/, "DataHub must expose date-addressable reported signals");

const signalsRoute = read("src/app/api/signals/route.ts");
assert.match(signalsRoute, /updatedAt:\s*\{\s*gte:\s*since\s*\}/, "ADN Lens API must include recently updated signals");

const chatRoute = read("src/app/api/chat/route.ts");
assert.match(chatRoute, /\/signals/, "chat slash commands must include /signals");

const internalNotificationsRoute = read("src/app/api/internal/notifications/route.ts");
assert.match(internalNotificationsRoute, /marketReport/, "bridge brief notifications must persist MarketReport rows for DataHub");

console.log("[verify-signal-reporting] OK");
