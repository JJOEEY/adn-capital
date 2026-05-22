type JsonRecord = Record<string, unknown>;

export type AdnCoreV2Options = {
  artScore?: number | null;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function formatPoint(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

function scoreFromSummary(summary: unknown, fallback: number | null, fromMax: number, toMax: number) {
  const text = String(summary ?? "");
  const match = text.match(/(-?\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/);
  const raw = match ? readNumber(match[1]) : fallback;
  const rawMax = match ? readNumber(match[2]) ?? fromMax : fromMax;
  if (raw == null || rawMax <= 0) return 0;
  return Math.max(0, Math.min(toMax, (raw / rawMax) * toMax));
}

function summaryFraction(summary: unknown, fallback: number | null, fallbackMax: number) {
  const text = String(summary ?? "");
  const match = text.match(/(-?\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/);
  const raw = match ? readNumber(match[1]) : fallback;
  const max = match ? readNumber(match[2]) ?? fallbackMax : fallbackMax;
  return { raw, max };
}

function peScore(pe: number | null) {
  if (pe == null || pe <= 0) return 0;
  if (pe <= 12) return 1;
  if (pe <= 14) return 0.5;
  if (pe <= 15) return -0.5;
  if (pe <= 18) return -1;
  return -1.5;
}

function pbScore(pb: number | null) {
  if (pb == null || pb <= 0) return 0;
  if (pb <= 1.5) return 1;
  if (pb <= 1.8) return 0.5;
  if (pb <= 2.2) return -0.5;
  if (pb <= 2.8) return -1;
  return -1.5;
}

function artScore(art: number | null) {
  if (art == null || art <= 0) return 0;
  if (art < 1) return 0.5;
  if (art < 3) return 1;
  if (art < 4) return 0;
  if (art <= 4.5) return -1.5;
  if (art < 4.8) return -2;
  return -2.5;
}

function describePe(pe: number | null, points: number) {
  if (pe == null || pe <= 0) return `P/E: chưa có dữ liệu → ${formatPoint(points)}đ`;
  if (points > 0) return `P/E = ${pe} → ${formatPoint(points)}đ`;
  return `P/E = ${pe} đang cao → ${formatPoint(points)}đ`;
}

function describePb(pb: number | null, points: number) {
  if (pb == null || pb <= 0) return `P/B: chưa có dữ liệu → ${formatPoint(points)}đ`;
  if (points > 0) return `P/B = ${pb} → ${formatPoint(points)}đ`;
  return `P/B = ${pb} đang cao → ${formatPoint(points)}đ`;
}

function describeArt(art: number | null, points: number) {
  if (art == null || art <= 0) return `ADN ART: chưa có dữ liệu → ${formatPoint(points)}đ`;
  if (points > 0) return `ADN ART = ${art} ở vùng thuận lợi → ${formatPoint(points)}đ`;
  if (points === 0) return `ADN ART = ${art} trung tính → ${formatPoint(points)}đ`;
  return `ADN ART = ${art} hưng phấn/căng → ${formatPoint(points)}đ`;
}

function normalizeReasons(payload: JsonRecord, valuationReasons: string[]) {
  const current = Array.isArray(payload.reasons) ? payload.reasons : [];
  const filtered = current.filter((item) => {
    const text = String(item ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    return !/^(p\/e|p\/b|adn art)\s*[=:]/.test(text);
  });
  return [...filtered, ...valuationReasons];
}

function hasWeeklyMacdRisk(payload: JsonRecord) {
  const technical = asRecord(payload.technical_highlights);
  const text = [
    payload.weekly_summary,
    technical.weekly,
    technical.divergence,
    ...(Array.isArray(payload.reasons) ? payload.reasons : []),
  ]
    .map((item) => String(item ?? ""))
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return (
    /phan ky am/.test(text) ||
    (/macd/.test(text) && /(cat xuong|cat giam|giam tu vung cao|vung cao)/.test(text))
  );
}

export function classifyAdnCoreV2(score: number) {
  if (score <= 3.49) {
    return {
      level: 1,
      statusBadge: "🔴 NGỦ ĐÔNG - TẮT APP",
      navAllocation: "0%",
      marginAllowed: false,
      actionMessage: "NGỦ ĐÔNG - TẮT APP. Không giao dịch, ưu tiên đứng ngoài thị trường.",
    };
  }
  if (score <= 5.49) {
    return {
      level: 1,
      statusBadge: "🔴 KHÔNG ĐẠT",
      navAllocation: "0%",
      marginAllowed: false,
      actionMessage: "KHÔNG ĐẠT. Giữ tiền là chính, không mua mới.",
    };
  }
  if (score <= 6.99) {
    return {
      level: 2,
      statusBadge: "🟡 TÌM KIẾM LEADER",
      navAllocation: "0-20%",
      marginAllowed: false,
      actionMessage: "TÌM KIẾM LEADER. Lọc cổ phiếu mạnh, chỉ thăm dò nhỏ khi có tín hiệu rõ.",
    };
  }
  if (score < 8.5) {
    return {
      level: 2,
      statusBadge: "🟢 GIA TĂNG MARGIN",
      navAllocation: "30-60%",
      marginAllowed: true,
      actionMessage: "GIA TĂNG MARGIN. Nâng tỷ trọng theo tín hiệu, ưu tiên cổ phiếu xác nhận xu hướng.",
    };
  }
  if (score < 9) {
    return {
      level: 3,
      statusBadge: "🟣 FULL MARGIN, CỔ PHIẾU ĐẦU NGÀNH",
      navAllocation: "80-100%",
      marginAllowed: true,
      actionMessage: "FULL MARGIN, CỔ PHIẾU ĐẦU NGÀNH. Tập trung leader và cổ phiếu dẫn dắt.",
    };
  }
  return {
    level: 3,
    statusBadge: "🟠 QUẢN TRỊ RỦI RO - ƯU TIÊN CHỐT LÃI",
    navAllocation: "Giảm rủi ro",
    marginAllowed: false,
    actionMessage: "QUẢN TRỊ RỦI RO - ƯU TIÊN CHỐT LÃI. Không mua đuổi, bảo vệ lợi nhuận.",
  };
}

export function normalizeAdnCoreV2<T extends JsonRecord>(payload: T, options: AdnCoreV2Options = {}): T {
  const technical = asRecord(payload.technical_highlights);
  const monthScore = scoreFromSummary(
    payload.monthly_summary ?? technical.monthly,
    readNumber(payload.monthly_score),
    4,
    4,
  );
  const rawWeekScore = scoreFromSummary(
    payload.weekly_summary ?? technical.weekly,
    readNumber(payload.weekly_score),
    6,
    3,
  );
  const weeklyFraction = summaryFraction(
    payload.weekly_summary ?? technical.weekly,
    readNumber(payload.weekly_score),
    6,
  );
  const weeklyRisk = hasWeeklyMacdRisk(payload);
  const weeklyCaution =
    weeklyFraction.raw != null &&
    weeklyFraction.max === 6 &&
    weeklyFraction.raw <= 4;
  const weekScore = weeklyRisk
    ? Math.min(rawWeekScore, 0.5)
    : weeklyCaution
      ? Math.min(rawWeekScore, 1)
      : rawWeekScore;
  const pe = readNumber(payload.pe);
  const pb = readNumber(payload.pb);
  const pePoints = peScore(pe);
  const pbPoints = pbScore(pb);
  const art = options.artScore ?? readNumber(payload.adn_art ?? payload.art ?? payload.rpi_current);
  const artPoints = artScore(art);
  const valuationReasons = [
    describePe(pe, pePoints),
    describePb(pb, pbPoints),
    describeArt(art, artPoints),
  ];
  const valuationSummary = valuationReasons.join(" · ");
  const total = Math.max(0, Math.min(10, round1(monthScore + weekScore + pePoints + pbPoints + artPoints)));
  const zone = classifyAdnCoreV2(total);

  return {
    ...payload,
    score: total,
    max_score: 10,
    ta_score: round1(monthScore + weekScore),
    ta_max: 7,
    valuation_score: round1(pePoints + pbPoints),
    valuation_max: 2,
    pe_score: pePoints,
    pb_score: pbPoints,
    adn_art: art ?? null,
    art_score: artPoints,
    art_max: 1,
    level: zone.level,
    status_badge: zone.statusBadge,
    nav_allocation: zone.navAllocation,
    margin_allowed: zone.marginAllowed,
    action_message: zone.actionMessage,
    technical_highlights: {
      ...technical,
      valuation: valuationSummary,
    },
    reasons: normalizeReasons(payload, valuationReasons),
    monthly_score: round1(monthScore),
    monthly_max: 4,
    weekly_score: round1(weekScore),
    weekly_max: 3,
    weekly_macd_risk: weeklyRisk,
    valuation_summary: valuationSummary,
    scoring_policy: {
      version: "adncore_v2_10pt",
      maxScore: 10,
      monthMax: 4,
      weekMax: 3,
      valuationMax: 2,
      artMax: 1,
      zones: [
        "0-3.49: NGỦ ĐÔNG - TẮT APP",
        "3.5-5.49: KHÔNG ĐẠT",
        "5.5-6.99: TÌM KIẾM LEADER",
        "7-8.49: GIA TĂNG MARGIN",
        "8.5-8.99: FULL MARGIN, CỔ PHIẾU ĐẦU NGÀNH",
        "9-10: QUẢN TRỊ RỦI RO - ƯU TIÊN CHỐT LÃI",
      ],
    },
  } as T;
}
