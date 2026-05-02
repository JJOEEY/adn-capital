const TICKER_EXCLUSIONS = new Set([
  "ADN",
  "AIDEN",
  "AI",
  "API",
  "BAN",
  "BOT",
  "BUY",
  "CAT",
  "CH",
  "CHO",
  "CHOT",
  "CO",
  "DANG",
  "DANH",
  "DAU",
  "DUOC",
  "CFO",
  "CAC",
  "GDP",
  "GIA",
  "GI",
  "GIO",
  "GIU",
  "HANG",
  "HAY",
  "HOLD",
  "HOM",
  "HOMNAY",
  "KHACH",
  "KHONG",
  "KHOAN",
  "MA",
  "MODE",
  "MUA",
  "MOI",
  "NAM",
  "NAO",
  "NAY",
  "NEN",
  "NGAY",
  "NHAN",
  "ON",
  "PH",
  "PHAN",
  "PHIEU",
  "SELL",
  "SANH",
  "SO",
  "THI",
  "TRUONG",
  "USD",
  "VA",
  "VN",
  "TA",
  "FA",
  "TICH",
  "TOI",
  "TRONG",
  "TU",
  "TY",
  "VE",
  "LO",
  "LOI",
  "PTKT",
  "PTCB",
  "NEWS",
  "TAMLY",
  "XEM",
]);

const EXPLICIT_TICKER_CONTEXT =
  "(?:ma|co\\s+phieu|cp|ticker|phan\\s+tich|nhan\\s+dinh|danh\\s+gia|so\\s+sanh|xem|mua|ban|gom|can\\s+mua|nen\\s+mua|co\\s+nen\\s+mua|ban\\s+bot)";

export function normalizeTickerText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D");
}

export function sanitizeTicker(value: string | null | undefined) {
  const ticker = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, "");
  if (!ticker || TICKER_EXCLUSIONS.has(ticker)) return "";
  if (/^(?:EMA|SMA|MA|RSI)\d{1,3}$/.test(ticker)) return "";
  if (/^(?:MACD|ADX|MFI|ROC|EPS|BVPS|NAV|TP|SL)$/.test(ticker)) return "";
  return ticker;
}

export function extractTickerCandidates(message: string, currentTicker?: string | null, limit = 5) {
  const candidates = new Set<string>();

  const addCandidate = (value: string | undefined) => {
    const token = sanitizeTicker(value);
    if (!token) return;
    candidates.add(token);
  };

  const trimmed = message.trim();
  if (/^[A-Za-z]{2,5}$/.test(trimmed)) {
    addCandidate(trimmed);
  }

  for (const match of message.matchAll(/\b[A-Z][A-Z0-9._-]{1,11}\b/g)) {
    addCandidate(match[0]);
  }

  const normalized = normalizeTickerText(message);
  const explicitPattern = new RegExp(`\\b${EXPLICIT_TICKER_CONTEXT}\\s*[:\\-]?\\s*([A-Za-z0-9._-]{2,12})\\b`, "gi");
  for (const match of normalized.matchAll(explicitPattern)) {
    addCandidate(match[1]);
  }

  const current = sanitizeTicker(currentTicker);
  if (candidates.size === 0 && current) candidates.add(current);

  return Array.from(candidates).slice(0, limit);
}

export function extractExplicitTickerCandidate(message: string) {
  return extractTickerCandidates(message, null, 1)[0] ?? null;
}
