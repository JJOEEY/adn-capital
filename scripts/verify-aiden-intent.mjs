import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = process.cwd();
const tmpDir = await mkdir(path.join(os.tmpdir(), `adn-aiden-intent-${Date.now()}`), { recursive: true });

async function transpileModule(srcPath, outPath, replacements = []) {
  let source = await readFile(path.join(repoRoot, srcPath), "utf8");
  for (const [from, to] of replacements) source = source.replace(from, to);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
  }).outputText;
  await writeFile(path.join(tmpDir, outPath), output, "utf8");
}

await transpileModule("src/lib/ticker-text.ts", "ticker-text.mjs");
await transpileModule("src/lib/aiden/intent.ts", "intent.mjs", [
  ['from "@/lib/ticker-text"', 'from "./ticker-text.mjs"'],
]);

const { classifyAidenIntent } = await import(pathToFileURL(path.join(tmpDir, "intent.mjs")).href);

const cases = [
  ["b\u1ea1n l\u00e0m \u0111c g\u00ec", "smalltalk", []],
  ["AIDEN gi\u00fap t\u00f4i \u0111\u01b0\u1ee3c g\u00ec", "smalltalk", []],
  ["t\u00f4i n\u00ean h\u1ecfi g\u00ec \u1edf \u0111\u00e2y", "smalltalk", []],
  ["b\u1ea1n l\u00e0m g\u00ec", "smalltalk", []],
  ["l\u00e0m sao \u0111\u1ec3 d\u00f9ng", "smalltalk", []],
  ["c\u00f3 g\u00ec m\u1edbi", "smalltalk", []],
  ["mua g\u00ec c\u0169ng \u0111\u01b0\u1ee3c kh\u00f4ng", "smalltalk", []],
  ["FPT", "ticker_analysis", ["FPT"]],
  ["ph\u00e2n t\u00edch FPT", "ticker_analysis", ["FPT"]],
  ["m\u00e3 hpg th\u1ebf n\u00e0o", "ticker_analysis", ["HPG"]],
  ["so s\u00e1nh HPG HSG", "compare", ["HPG", "HSG"]],
  ["b\u00e1n FPT \u0111\u01b0\u1ee3c kh\u00f4ng", "ticker_analysis", ["FPT"]],
];

try {
  for (const [input, expectedIntent, expectedCandidates] of cases) {
    const result = classifyAidenIntent(input);
    assert.equal(result.intent, expectedIntent, `${input}: intent`);
    assert.deepEqual(result.candidates, expectedCandidates, `${input}: candidates`);
  }
  console.log(`AIDEN intent cases passed: ${cases.length}`);
} finally {
  await rm(tmpDir, { recursive: true, force: true });
}
