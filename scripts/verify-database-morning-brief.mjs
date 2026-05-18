import fs from "fs";
import path from "path";

const ROOT = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

const builderFile = "src/lib/database/morning-brief.ts";
const endpointFile = "src/app/api/internal/database/morning/brief/route.ts";
const typesFile = "src/lib/database/providers/news/types.ts";

const builder = read(builderFile);
const endpoint = read(endpointFile);
const types = read(typesFile);

const checks = [
  {
    name: "morning_brief_builder_exists",
    ok: builder.includes("getDatabaseMorningBrief") && builder.includes("database-v2-morning-brief"),
  },
  {
    name: "morning_brief_endpoint_exists",
    ok: fs.existsSync(path.join(ROOT, endpointFile)) && endpoint.includes("getDatabaseMorningBrief"),
  },
  {
    name: "keeps_existing_web_payload_shape",
    ok: ["reference_indices", "vn_market", "macro", "risk_opportunity"].every((field) => builder.includes(field)),
  },
  {
    name: "splits_vietnam_and_global_news",
    ok: builder.includes("Vĩ mô trong nước") && builder.includes("Quốc tế") && builder.includes("Nhóm dầu khí & năng lượng"),
  },
  {
    name: "adds_assessment_without_layout_change",
    ok: builder.includes("Nhận định chung") && !read("src/components/dashboard/MorningNews.tsx").includes("database-v2-morning-brief"),
  },
  {
    name: "typed_payload",
    ok: types.includes("DatabaseMorningBriefPayload"),
  },
];

const report = {
  checkedAt: new Date().toISOString(),
  ok: checks.every((check) => check.ok),
  checks,
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
