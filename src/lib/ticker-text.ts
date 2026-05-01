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

  const upper = normalizeTickerText(message).toUpperCase();
  for (const match of upper.matchAll(/\b[A-Z][A-Z0-9._-]{1,11}\b/g)) {
    const token = sanitizeTicker(match[0]);
    if (!token) continue;
    candidates.add(token);
  }

  const current = sanitizeTicker(currentTicker);
  if (candidates.size === 0 && current) candidates.add(current);

  return Array.from(candidates).slice(0, limit);
}

export function extractExplicitTickerCandidate(message: string) {
  return extractTickerCandidates(message, null, 1)[0] ?? null;
}
