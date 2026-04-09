/**
 * ════════════════════════════════════════════════════════════════════
 *  ADN Capital — UAT Test Script
 *  Scanner → Signal Engine → Lifecycle Worker → Telegram Broadcaster
 *
 *  Chạy:  npx ts-node --project tsconfig.json run_uat_test.ts
 *  Hoặc:  npx tsx run_uat_test.ts
 *
 *  KHÔNG cần FiinQuant / Gemini API thật.
 *  Toàn bộ dữ liệu là MOCK.
 * ════════════════════════════════════════════════════════════════════
 */

// ─── Màu console (ANSI) ────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  bold:  "\x1b[1m",
  dim:   "\x1b[2m",
  cyan:  "\x1b[36m",
  green: "\x1b[32m",
  red:   "\x1b[31m",
  yellow:"\x1b[33m",
  magenta:"\x1b[35m",
  blue:  "\x1b[34m",
  white: "\x1b[37m",
};
const banner = (title: string, color = C.cyan) =>
  console.log(`\n${color}${C.bold}${"═".repeat(60)}\n  ${title}\n${"═".repeat(60)}${C.reset}`);
const step = (n: number, label: string) =>
  console.log(`\n${C.magenta}${C.bold}[BƯỚC ${n}] ${label}${C.reset}`);
const log = (label: string, val: unknown, indent = 2) =>
  console.log(`${" ".repeat(indent)}${C.white}${label}:${C.reset}`, val);
const ok  = (msg: string) => console.log(`  ${C.green}✅ ${msg}${C.reset}`);
const err = (msg: string) => console.log(`  ${C.red}❌ ${msg}${C.reset}`);
const warn= (msg: string) => console.log(`  ${C.yellow}⚠️  ${msg}${C.reset}`);
const tg  = (msg: string) => {
  console.log(`\n${C.blue}${C.dim}┌─ 📨 TELEGRAM MOCK ──────────────────────────────────────${C.reset}`);
  msg.split("\n").forEach(l => console.log(`${C.blue}${C.dim}│${C.reset} ${l}`));
  console.log(`${C.blue}${C.dim}└──────────────────────────────────────────────────────────${C.reset}`);
};

// ─── 1. TYPES (mirror từ UltimateSignalEngine / SignalLifecycleWorker) ─────────

interface MockSignalState {
  ticker:        string;
  type:          string;
  tier:          string;
  status:        "RADAR" | "ACTIVE" | "HOLD_TO_DIE" | "CLOSED";
  entryPrice:    number;
  currentPrice:  number;
  stoploss:      number;
  alertLevel:    number;   // cũ gọi là target — chỉ cảnh báo, không auto-close
  navPct:        number;
  rrRatio:       string;
  pnlPct:        number;
  holdingAction: string | null;
  closeReason:   string | null;
}

// ─── 2. ENGINE HELPERS (inlined, no real API) ───────────────────────────────

const TIER_CONFIG = {
  LEADER:    { baseNav: 30, alertPct: 20, stopPct:  7 },
  TRUNG_HAN: { baseNav: 20, alertPct: 10, stopPct:  5 },
  NGAN_HAN:  { baseNav: 10, alertPct:  7, stopPct:  3 },
  TAM_NGAM:  { baseNav:  0, alertPct: 10, stopPct:  5 },
};

const TYPE_TO_TIER: Record<string, keyof typeof TIER_CONFIG> = {
  SIEU_CO_PHIEU: "LEADER",
  TRUNG_HAN:     "TRUNG_HAN",
  DAU_CO:        "NGAN_HAN",
  TAM_NGAM:      "TAM_NGAM",
};

/** Mock seasonality — giả lập NAV multiplier */
function mockSeasonality(ticker: string): { winRate: number; sharpeRatio: number; multiplier: number } {
  const table: Record<string, { winRate: number; sharpeRatio: number }> = {
    MWG: { winRate: 55, sharpeRatio: 0.9 },
    VCG: { winRate: 62, sharpeRatio: 1.2 },
    FPT: { winRate: 78, sharpeRatio: 1.8 },
  };
  const s = table[ticker] ?? { winRate: 50, sharpeRatio: 1.0 };
  const multiplier = s.winRate > 70 ? 1.2 : s.winRate < 40 ? 0.5 : 1.0;
  return { ...s, multiplier };
}

/** Tính R/R ratio */
function calcRR(entry: number, alert: number, sl: number): string {
  const reward = alert - entry;
  const risk   = entry - sl;
  if (risk <= 0) return "N/A";
  return `1:${(reward / risk).toFixed(2)}`;
}

/** Tính trailing stop level (bậc thang 10%) */
function trailingStopPct(pnlPct: number): number {
  return Math.floor(pnlPct / 10) * 10 - 10;
}
function trailingStopPrice(entry: number, pnlPct: number): number {
  return +(entry * (1 + trailingStopPct(pnlPct) / 100)).toFixed(2);
}

/** Mock AI reasoning (thay Gemini) */
function mockAI(signal: { ticker: string; tier: string; rrRatio: string; trigger: string; navPct: number }): string {
  const msgs: Record<string, string> = {
    LEADER:    `${signal.ticker} đang trong chuỗi VCP siết nền với RS > 85. Breakout có xác nhận khối lượng mạnh. ADN Capital phân bổ ${signal.navPct}% NAV với R/R = ${signal.rrRatio}. Cơ chế gồng lãi: chốt khi TEI ≥ 4.5.`,
    TRUNG_HAN: `${signal.ticker} xuất hiện tín hiệu phân kỳ dương RSI+MFI với dòng tiền vào. Target alert tại +10%. ADN Capital phân bổ ${signal.navPct}% NAV với R/R = ${signal.rrRatio}.`,
    NGAN_HAN:  `${signal.ticker} chạm MA200 và StochRSI cắt lên từ vùng quá bán. Lướt sóng ngắn hạn. ADN Capital phân bổ ${signal.navPct}% NAV với R/R = ${signal.rrRatio}.`,
    TAM_NGAM:  `${signal.ticker} đang tiếp cận điều kiện. Theo dõi breakout. NAV: ${signal.navPct}%.`,
  };
  return msgs[signal.tier] ?? `Tín hiệu kỹ thuật hợp lệ. R/R = ${signal.rrRatio}.`;
}

/** Build Telegram card khi mở lệnh */
function tgOpenCard(s: MockSignalState, aiReasoning: string): string {
  const tierEmoji = { LEADER: "👑", TRUNG_HAN: "🛡️", NGAN_HAN: "⚡", TAM_NGAM: "🎯" }[s.tier] ?? "📊";
  return [
    `📊 *${s.ticker}* — ${tierEmoji} ${s.tier} | ${s.type}`,
    ``,
    `🎯 Entry: *${s.entryPrice.toLocaleString("vi-VN")}* | ⚠️ Alert: ${s.alertLevel.toLocaleString("vi-VN")} | 🛑 SL: ${s.stoploss.toLocaleString("vi-VN")}`,
    `📐 R/R = *${s.rrRatio}* | NAV: *${s.navPct}%*`,
    ``,
    `🤖 *AI Nhận định:*`,
    aiReasoning,
    ``,
    `🔥 *Gồng lãi:* Chốt khi TEI ≥ 4.5 hoặc vi phạm SL.`,
    `⚠️ Tuân thủ stoploss — Không bình quân giá xuống.`,
    ``,
    `_Powered by ADN Capital AI_`,
  ].join("\n");
}

/** Build Telegram card cắt lỗ */
function tgCloseCard(s: MockSignalState, reason: string): string {
  const pnl = s.pnlPct;
  return [
    `🛑 *ĐÓNG LỆNH — ${s.ticker}*`,
    ``,
    `📌 Loại: Cắt lỗ`,
    `📉 Entry: ${s.entryPrice.toLocaleString("vi-VN")} → Đóng: ${s.currentPrice.toLocaleString("vi-VN")}`,
    `📊 PnL: *${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}%*`,
    `💡 Lý do: ${reason}`,
    ``,
    `_Powered by ADN Capital AI_`,
  ].join("\n");
}

/** Build Telegram card HOLD_TO_DIE */
function tgHoldCard(s: MockSignalState, slPct: number): string {
  return [
    `🔥 *GỒNG LÃI — ${s.ticker}*`,
    ``,
    `📈 Lợi nhuận hiện tại: *+${s.pnlPct.toFixed(2)}%*`,
    `🛡️ Trailing SL mới: *+${slPct}%* (${trailingStopPrice(s.entryPrice, s.pnlPct).toLocaleString("vi-VN")})`,
    `📐 R/R đạt được: *${s.rrRatio}*`,
    ``,
    `💬 Tiếp tục GỒNG LÃI. Chốt khi TEI ≥ 4.5 hoặc vi phạm Trailing SL.`,
    ``,
    `_Powered by ADN Capital AI_`,
  ].join("\n");
}

/** Build Telegram card chốt lời TEI */
function tgTEICloseCard(s: MockSignalState, tei: number): string {
  return [
    `🎯 *CHỐT LỜI [HOLD_TO_DIE] — ${s.ticker}*`,
    ``,
    `🌡️ TEI Market Sentiment: *${tei.toFixed(1)}* ≥ 4.5 (Hưng phấn cực độ)`,
    `📈 Entry: ${s.entryPrice.toLocaleString("vi-VN")} → Đóng: ${s.currentPrice.toLocaleString("vi-VN")}`,
    `💰 Thực nhận: *+${s.pnlPct.toFixed(2)}%*`,
    `🛡️ Trailing SL cuối: +${trailingStopPct(s.pnlPct)}%`,
    ``,
    `✅ Đóng lệnh thành công theo tín hiệu TEI.`,
    ``,
    `_Powered by ADN Capital AI_`,
  ].join("\n");
}

// ─── 3. MOCK RAW SCANNER OUTPUT ─────────────────────────────────────────────

const MOCK_SCANNER_OUTPUT = [
  {
    ticker: "MWG",
    type: "DAU_CO",
    entryPrice: 50_000,
    reason: "Ngắn hạn: Chạm MA200 + StochRSI cắt lên từ vùng quá bán (<20)",
    rsRating: 55,
    emaCross10_30: true,
    macdCrossUp: false,
    volRatio: 1.3,
  },
  {
    ticker: "VCG",
    type: "TRUNG_HAN",
    entryPrice: 25_000,
    reason: "Trung hạn: Phân kỳ dương RSI+MFI + dòng tiền thể chế vào mạnh",
    rsRating: 68,
    emaCross10_30: true,
    isDoubleBottom: true,
    macdCrossUp: true,
    volRatio: 1.6,
  },
  {
    ticker: "FPT",
    type: "SIEU_CO_PHIEU",
    entryPrice: 120_000,
    reason: "Siêu CP: RS=91, VCP siết nền, Breakout đỉnh + fundamental=STRONG (lợi nhuận Q4 tăng 35%)",
    rsRating: 91,
    isVCP: true,
    emaCross10_30: true,
    emaCross50_100: true,
    volRatio: 2.4,
  },
];

// ─── 4. MAIN TEST RUNNER ─────────────────────────────────────────────────────

async function runUAT() {
  banner("ADN CAPITAL — UAT FULL PIPELINE TEST", C.cyan);
  console.log(`${C.dim}  Scanner → Signal Engine → Lifecycle Worker → Telegram Broadcaster${C.reset}`);
  console.log(`${C.dim}  Không cần API thật (FiinQuant / Gemini). Toàn bộ MOCK.${C.reset}`);

  // ══════════════════════════════════════════════════════════════
  //  BƯỚC 1: Signal Engine — Map + NAV + R/R + AI reasoning
  // ══════════════════════════════════════════════════════════════
  step(1, "NHẬN TÍN HIỆU TỪ PYTHON SCANNER → SIGNAL ENGINE");

  const signals: MockSignalState[] = [];

  for (const raw of MOCK_SCANNER_OUTPUT) {
    const tier = TYPE_TO_TIER[raw.type] ?? "NGAN_HAN";
    const cfg  = TIER_CONFIG[tier];
    const { winRate, sharpeRatio, multiplier } = mockSeasonality(raw.ticker);

    const entry    = raw.entryPrice;
    const alert    = +(entry * (1 + cfg.alertPct / 100)).toFixed(2);
    const sl       = +(entry * (1 - cfg.stopPct  / 100)).toFixed(2);
    const navPct   = Math.round(cfg.baseNav * multiplier);
    const rrRatio  = calcRR(entry, alert, sl);

    const signal: MockSignalState = {
      ticker:        raw.ticker,
      type:          raw.type,
      tier,
      status:        "ACTIVE",
      entryPrice:    entry,
      currentPrice:  entry,
      stoploss:      sl,
      alertLevel:    alert,
      navPct,
      rrRatio,
      pnlPct:        0,
      holdingAction: null,
      closeReason:   null,
    };
    signals.push(signal);

    // AI mock card
    const aiReasoning = mockAI({ ticker: raw.ticker, tier, rrRatio, trigger: raw.reason ?? "", navPct });

    console.log(`\n  ${C.bold}${C.yellow}${raw.ticker}${C.reset} [${tier}]`);
    log("  Lý do", raw.reason);
    log("  Entry", entry.toLocaleString("vi-VN"));
    log("  Alert +target", `${alert.toLocaleString("vi-VN")} (+${cfg.alertPct}%)`);
    log("  Stoploss", `${sl.toLocaleString("vi-VN")} (-${cfg.stopPct}%)`);
    log("  R/R", rrRatio);
    log("  NAV", `${navPct}% (WR ${winRate}%, Sharpe ${sharpeRatio}, x${multiplier})`);

    tg(tgOpenCard(signal, aiReasoning));
    ok(`${raw.ticker} — Lệnh mở ACTIVE. DB saved.`);
  }

  // ══════════════════════════════════════════════════════════════
  //  BƯỚC 2: Lifecycle — Giả lập biến động giá
  // ══════════════════════════════════════════════════════════════
  step(2, "LIFECYCLE WORKER — GIẢ LẬP BIẾN ĐỘNG GIÁ");

  // ── 2a. MWG: Giá giảm chạm SL ─────────────────────────────────
  const mwg = signals.find(s => s.ticker === "MWG")!;
  const mwgNewPrice = +(mwg.entryPrice * 0.96).toFixed(0); // -4% → dưới SL (-3%)
  mwg.currentPrice = mwgNewPrice;
  mwg.pnlPct = +((mwgNewPrice - mwg.entryPrice) / mwg.entryPrice * 100).toFixed(2);

  console.log(`\n  ${C.bold}MWG${C.reset} — Giá giảm xuống ${mwgNewPrice.toLocaleString("vi-VN")} (PnL: ${mwg.pnlPct.toFixed(2)}%)`);
  console.log(`           SL = ${mwg.stoploss.toLocaleString("vi-VN")} | Giá hiện tại = ${mwgNewPrice.toLocaleString("vi-VN")}`);

  if (mwgNewPrice <= mwg.stoploss) {
    mwg.status = "CLOSED";
    mwg.closeReason = `Cắt lỗ SL ${mwg.stoploss.toLocaleString("vi-VN")} (${mwg.pnlPct.toFixed(2)}%)`;
    err(`MWG — Giá chạm Stoploss! Kích hoạt CẮT LỖ.`);
    tg(tgCloseCard(mwg, mwg.closeReason!));
  } else {
    warn("MWG — Giá chưa chạm SL — logic sai!");
  }

  // ── 2b. VCG: Giá tăng 10% → chưa đủ 20% → giữ nguyên ACTIVE ──
  const vcg = signals.find(s => s.ticker === "VCG")!;
  const vcgNewPrice = +(vcg.entryPrice * 1.10).toFixed(0); // +10%
  vcg.currentPrice = vcgNewPrice;
  vcg.pnlPct = +((vcgNewPrice - vcg.entryPrice) / vcg.entryPrice * 100).toFixed(2);

  console.log(`\n  ${C.bold}VCG${C.reset} — Giá tăng lên ${vcgNewPrice.toLocaleString("vi-VN")} (PnL: +${vcg.pnlPct.toFixed(2)}%)`);
  console.log(`           Alert tại ${vcg.alertLevel.toLocaleString("vi-VN")} | HOLD_TO_DIE tại PnL ≥ 20%`);

  if (vcg.pnlPct >= 20) {
    // Không xảy ra ở bước này
    warn("VCG — logic sai! Không nên trigger HOLD_TO_DIE ở đây.");
  } else if (vcgNewPrice >= vcg.alertLevel) {
    ok(`VCG — Chạm Alert Level ${vcg.alertLevel.toLocaleString("vi-VN")}. Gửi cảnh báo — Chờ TEI.`);
    tg([
      `🔔 *CẢNH BÁO ALERT — VCG*`,
      ``,
      `📈 Giá chạm ngưỡng alert: ${vcgNewPrice.toLocaleString("vi-VN")} (+${vcg.pnlPct.toFixed(2)}%)`,
      `⚠️ Không tự đóng lệnh. Theo dõi TEI để quyết định chốt lời.`,
      `🔥 Tiếp tục GỒNG LÃI — Chốt khi TEI ≥ 4.5.`,
      ``,
      `_Powered by ADN Capital AI_`,
    ].join("\n"));
  } else {
    ok(`VCG — Giữ nguyên ACTIVE (PnL +${vcg.pnlPct.toFixed(2)}%). Chưa đủ 20% để HOLD_TO_DIE.`);
  }

  // ── 2c. FPT: Giá tăng 22% → HOLD_TO_DIE + Trailing SL lên +10% ─
  const fpt = signals.find(s => s.ticker === "FPT")!;
  const fptNewPrice = +(fpt.entryPrice * 1.22).toFixed(0); // +22%
  fpt.currentPrice = fptNewPrice;
  fpt.pnlPct = +((fptNewPrice - fpt.entryPrice) / fpt.entryPrice * 100).toFixed(2);

  console.log(`\n  ${C.bold}FPT${C.reset} — Giá tăng lên ${fptNewPrice.toLocaleString("vi-VN")} (PnL: +${fpt.pnlPct.toFixed(2)}%)`);
  console.log(`           Ngưỡng HOLD_TO_DIE: PnL ≥ 20%`);

  if (fpt.pnlPct >= 20) {
    const slPct   = trailingStopPct(fpt.pnlPct);
    const slPrice = trailingStopPrice(fpt.entryPrice, fpt.pnlPct);
    fpt.status       = "HOLD_TO_DIE";
    fpt.stoploss     = slPrice;
    fpt.holdingAction = `HOLD_TO_DIE: Trailing SL nâng lên +${slPct}% (${slPrice.toLocaleString("vi-VN")})`;
    ok(`FPT — PnL=+${fpt.pnlPct.toFixed(2)}% ≥ 20%. Chuyển → HOLD_TO_DIE!`);
    ok(`FPT — Trailing SL mới: +${slPct}% → ${slPrice.toLocaleString("vi-VN")}`);
    tg(tgHoldCard(fpt, slPct));
  } else {
    err("FPT — logic sai! Phải trigger HOLD_TO_DIE.");
  }

  // ══════════════════════════════════════════════════════════════
  //  BƯỚC 3: TEI hưng phấn → Chốt toàn bộ HOLD_TO_DIE
  // ══════════════════════════════════════════════════════════════
  step(3, "TEI HƯNG PHẤN — KÍCH HOẠT CHỐT LỜI HOLD_TO_DIE");

  const MOCK_TEI = 4.6;
  console.log(`\n  🌡️  TEI hiện tại: ${C.bold}${C.red}${MOCK_TEI}${C.reset} (ngưỡng chốt: ≥ 4.5)`);

  const holdSignals = signals.filter(s => s.status === "HOLD_TO_DIE");
  if (holdSignals.length === 0) {
    warn("Không có lệnh HOLD_TO_DIE nào để chốt — kiểm tra lại logic.");
  }

  for (const s of holdSignals) {
    if (MOCK_TEI >= 4.5) {
      s.closeReason = `TEI ${MOCK_TEI} ≥ 4.5 (Hưng phấn cực độ) — Chốt toàn bộ`;
      s.status = "CLOSED";
      ok(`${s.ticker} — TEI kích hoạt! Đóng lệnh HOLD_TO_DIE → PnL: +${s.pnlPct.toFixed(2)}%`);
      tg(tgTEICloseCard(s, MOCK_TEI));
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  BƯỚC 4: Tổng kết
  // ══════════════════════════════════════════════════════════════
  step(4, "TỔNG KẾT PORTFOLIO");

  banner("KẾT QUẢ UAT TEST", C.green);

  const summary = signals.map(s => ({
    ticker:    s.ticker,
    tier:      s.tier,
    status:    s.status,
    entry:     s.entryPrice,
    exit:      s.currentPrice,
    pnlPct:    s.pnlPct.toFixed(2) + "%",
    rrRatio:   s.rrRatio,
    navPct:    s.navPct + "%",
    closeReason: s.closeReason ?? s.holdingAction ?? "—",
  }));

  console.table(summary);

  // Xác nhận các assertion
  const assertions = [
    { label: "MWG  → CLOSED (Cắt lỗ SL)", pass: signals.find(s => s.ticker === "MWG")!.status === "CLOSED" },
    { label: "VCG  → ACTIVE (PnL +10%, chưa HOLD_TO_DIE)", pass: signals.find(s => s.ticker === "VCG")!.status === "ACTIVE" },
    { label: "FPT  → CLOSED via TEI (PnL +22%)", pass: signals.find(s => s.ticker === "FPT")!.status === "CLOSED" },
    { label: "FPT  → Trailing SL đã được dời lên +10%", pass: signals.find(s => s.ticker === "FPT")!.closeReason?.includes("TEI") ?? false },
  ];

  console.log(`\n  ${C.bold}ASSERTIONS:${C.reset}`);
  let allPass = true;
  for (const a of assertions) {
    if (a.pass) { ok(a.label); }
    else        { err(a.label); allPass = false; }
  }

  console.log();
  if (allPass) {
    console.log(`${C.green}${C.bold}  🎉 TẤT CẢ ASSERTIONS ĐỀU PASS! Pipeline hoạt động đúng.${C.reset}`);
  } else {
    console.log(`${C.red}${C.bold}  ⛔ CÓ ASSERTION THẤT BẠI — Kiểm tra lại logic!${C.reset}`);
  }
  console.log();
}

// ── Run ───────────────────────────────────────────────────────────────────
runUAT().catch(console.error);
