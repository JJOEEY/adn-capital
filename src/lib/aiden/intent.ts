import { normalizeTickerText } from "@/lib/ticker-text";

export type AidenIntent = "smalltalk" | "general_market" | "ticker_analysis" | "compare" | "signals";

export type AidenIntentResult = {
  intent: AidenIntent;
  candidates: string[];
};

const COMMON_WORDS = new Set([
  "ADN",
  "AIDEN",
  "AI",
  "API",
  "BAN",
  "BOT",
  "CAC",
  "CAI",
  "CAN",
  "CHO",
  "CO",
  "CON",
  "CUA",
  "DC",
  "DUOC",
  "GI",
  "GIA",
  "GIUP",
  "HAY",
  "HOI",
  "KHONG",
  "LAM",
  "MA",
  "MINH",
  "MOI",
  "MUA",
  "NAO",
  "NAY",
  "NEN",
  "NHU",
  "ROI",
  "SAO",
  "THE",
  "THI",
  "TOI",
  "TU",
  "VA",
  "VE",
  "VND",
  "VOI",
]);

const MARKET_WORDS = [
  "thi truong",
  "vnindex",
  "vn-index",
  "vn30",
  "chung khoan",
  "co phieu",
  "danh muc",
  "dong tien",
  "thanh khoan",
  "tin hieu",
  "radar",
  "mua ma gi",
  "co nao",
  "top ma",
  "loc co phieu",
];

const HELP_PATTERNS = [
  /\bban\s+(?:lam|giup)\b/,
  /\blam\s+(?:duoc|dc)\s+gi\b/,
  /\bgiup\s+(?:toi|minh)\s+duoc\s+gi\b/,
  /\bhoi\s+gi\b/,
  /\bdung\s+(?:nhu\s+)?the\s+nao\b/,
  /\baiden\s+.*\b(?:lam|giup)\b/,
];

function unique(items: string[]) {
  return Array.from(new Set(items));
}

function normalizeMessage(message: string) {
  return normalizeTickerText(message).toLowerCase().replace(/\s+/g, " ").trim();
}

function sanitizeCandidate(value: string | undefined) {
  const candidate = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, "");
  if (!/^[A-Z0-9._-]{2,12}$/.test(candidate)) return "";
  if (COMMON_WORDS.has(candidate)) return "";
  if (/^(?:EMA|SMA|MA|RSI)\d{1,3}$/.test(candidate)) return "";
  if (/^(?:MACD|ADX|MFI|ROC|EPS|BVPS|NAV|TP|SL)$/.test(candidate)) return "";
  return candidate;
}

function uppercaseCandidates(message: string) {
  return [...message.matchAll(/\b[A-Z][A-Z0-9._-]{1,11}\b/g)]
    .map((match) => sanitizeCandidate(match[0]))
    .filter(Boolean);
}

function explicitTickerCandidates(message: string) {
  const rawCandidates: string[] = [];
  const normalized = normalizeTickerText(message);

  const nounOrAnalysisPattern =
    /\b(?:ma|co\s+phieu|cp|ticker|phan\s+tich|nhan\s+dinh|danh\s+gia|xem|review|chart|ptkt|ptcb)\s*[:\-]?\s*([A-Za-z0-9._-]{2,12})\b/gi;
  for (const match of normalized.matchAll(nounOrAnalysisPattern)) {
    rawCandidates.push(match[1]);
  }

  const accentedOrNeutralActionPattern =
    /\b(?:b\u00e1n|mua|gom|gi\u1eef|giu|hold|c\u1eaft\s+l\u1ed7|cat\s+lo|ch\u1ed1t\s+l\u1eddi|chot\s+loi)\s+([A-Za-z0-9._-]{2,12})\b/giu;
  for (const match of message.matchAll(accentedOrNeutralActionPattern)) {
    rawCandidates.push(match[1]);
  }

  const noAccentActionWithUppercasePattern =
    /\b(?:ban|mua|gom|giu|hold|cat\s+lo|chot\s+loi)\s+([A-Z][A-Z0-9._-]{1,11})\b/g;
  for (const match of normalized.matchAll(noAccentActionWithUppercasePattern)) {
    rawCandidates.push(match[1]);
  }

  return rawCandidates.map(sanitizeCandidate).filter(Boolean);
}

function bareTickerCandidate(message: string) {
  const trimmed = message.trim();
  if (!/^[A-Za-z0-9._-]{2,12}$/.test(trimmed)) return null;
  return sanitizeCandidate(trimmed);
}

export function classifyAidenIntent(message: string): AidenIntentResult {
  const normalized = normalizeMessage(message);
  if (!normalized) return { intent: "smalltalk", candidates: [] };

  if (/^\/(?:signals|tin-hieu|reported)\b/i.test(message.trim())) {
    return { intent: "signals", candidates: [] };
  }

  const explicit = explicitTickerCandidates(message);
  const uppercase = uppercaseCandidates(message);
  const bare = bareTickerCandidate(message);
  const candidates = unique([...explicit, ...uppercase, ...(bare ? [bare] : [])]).slice(0, 5);

  const asksCompare = /\b(?:so\s+sanh|compare|vs|voi)\b/i.test(normalized);
  if (asksCompare && candidates.length >= 2) {
    return { intent: "compare", candidates };
  }

  if (bare || explicit.length > 0 || uppercase.length > 0) {
    return { intent: "ticker_analysis", candidates: candidates.slice(0, 3) };
  }

  if (HELP_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { intent: "smalltalk", candidates: [] };
  }

  if (MARKET_WORDS.some((word) => normalized.includes(word))) {
    return { intent: "general_market", candidates: [] };
  }

  return { intent: "smalltalk", candidates: [] };
}
