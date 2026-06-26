import { EmbedBuilder } from "discord.js";
import { BRAND } from "./config.js";

const pct = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${Number(v).toFixed(2)}%`);
const num = (v) => (v == null ? "—" : Number(v).toLocaleString("vi-VN", { maximumFractionDigits: 2 }));
const dirColor = (v) => (v == null ? BRAND.color : v >= 0 ? BRAND.up : BRAND.down);

// Nhãn tiếng Việt cho loại tín hiệu (tránh lộ enum kiểu TRUNG_HAN ra UI).
function signalKindLabel(type) {
  const t = String(type || "").toUpperCase();
  if (t.includes("SIEU")) return "Siêu cổ phiếu";
  if (t.includes("LEADER")) return "Dẫn dắt";
  if (t.includes("TRUNG")) return "Trung hạn";
  if (t.includes("DAU")) return "Đầu cơ";
  if (t.includes("NGAN")) return "Ngắn hạn";
  if (t.includes("TAM")) return "Tầm ngắm";
  return "Tín hiệu ADN";
}

// Lọc insight AI hỏng (quá tải / cợt nhả / từ chối — hay bị cache) → ẩn, không hiện ra UI.
const AI_BAD_RE = /quá tải|thử lại sau|đại ca|khổng minh|em không thể|em không phải|không có bất kỳ/i;
function usableInsight(text) {
  const t = String(text || "").trim();
  if (t.length < 30) return "";
  if (AI_BAD_RE.test(t)) return "";
  return t;
}

function rsLabel(rs) {
  if (rs > 90) return "🟣 Super Star";
  if (rs >= 80) return "🟢 Star";
  if (rs >= 60) return "🟡 Watch";
  return "⚪ Farmer";
}

export function stockEmbed(ticker, { price, changePercent, rs, sector, name } = {}) {
  return new EmbedBuilder()
    .setColor(dirColor(changePercent))
    .setTitle(`📈 ${ticker}${name && name !== ticker ? ` · ${name}` : ""}`)
    .addFields(
      { name: "Giá", value: num(price), inline: true },
      { name: "Thay đổi", value: pct(changePercent), inline: true },
      { name: "ADN Rank", value: rs != null ? `${rs} · ${rsLabel(rs)}` : "—", inline: true },
      { name: "Ngành", value: sector || "—", inline: false },
    )
    .setFooter({ text: BRAND.footer });
}

export function rankEmbed(stocks, { sector } = {}) {
  const top = stocks
    .filter((s) => (sector ? s.sector === sector : true))
    .sort((a, b) => (b.rsRating ?? 0) - (a.rsRating ?? 0))
    .slice(0, 15);
  const lines = top.map((s, i) =>
    `\`${String(i + 1).padStart(2)}\` **${s.symbol}**  ·  RS \`${s.rsRating ?? "—"}\`  ·  ${pct(s.changePercent)}`,
  );
  return new EmbedBuilder()
    .setColor(BRAND.color)
    .setTitle(`🏆 ADN Rank${sector ? ` · ${sector}` : ""} — Top 15`)
    .setDescription(lines.join("\n") || "Không có dữ liệu.")
    .setFooter({ text: BRAND.footer });
}

export function signalEmbed(sig) {
  const t = String(sig.type || "").toUpperCase();
  const tag = t.includes("SIEU") ? "🔥 SIÊU CỔ PHIẾU" : t.includes("TRUNG") ? "📊 TRUNG HẠN"
    : t.includes("DAU") ? "⚡ NGẮN HẠN" : t.includes("TAM") ? "👀 TẦM NGẮM" : t || "TÍN HIỆU";
  return new EmbedBuilder()
    .setColor(BRAND.up)
    .setTitle(`${tag} · ${sig.ticker}`)
    .setDescription(sig.reason || "")
    .addFields(
      { name: "Điểm mua", value: num(sig.entryPrice), inline: true },
      { name: "Mục tiêu", value: num(sig.target), inline: true },
      { name: "Cắt lỗ", value: num(sig.stoploss), inline: true },
    )
    .setFooter({ text: BRAND.footer })
    .setTimestamp();
}

// ── /ptkt — phân tích kỹ thuật (data.technical + data.behavior từ /api/widget) ──
export function ptktEmbed(ticker, technical = {}, behavior = {}, signal = null) {
  const ta = technical.stats || {};
  const p = ta.price || {};
  const ind = ta.indicators || {};
  const tr = ta.trend || {};
  const lv = ta.levels || {};
  const ema = [ind.ema10, ind.ema50, ind.ema200]
    .map((v) => (v == null ? "—" : num(v)))
    .join(" / ");
  const price = p.current ?? null;
  const sup = lv.support ?? null;
  const res = lv.resistance ?? null;
  const atr = ind.atr14 ?? null;

  const e = new EmbedBuilder()
    .setColor(dirColor(p.changePct))
    .setTitle(`📊 PTKT · ${ticker}`)
    .addFields(
      { name: "Giá", value: `${num(price)} (${pct(p.changePct)})`, inline: true },
      { name: "Xu hướng", value: `${tr.direction || "—"}${tr.adx != null ? ` · ADX ${num(tr.adx)}` : ""}`, inline: true },
      { name: "RSI(14)", value: num(ind.rsi14), inline: true },
      { name: "MACD Hist", value: num(ind.macdHistogram), inline: true },
      { name: "MFI(14)", value: num(ind.mfi14), inline: true },
      { name: "ART (đảo chiều)", value: behavior.teiScore != null ? `${num(behavior.teiScore)} · ${behavior.status || "—"}` : "—", inline: true },
      { name: "EMA 10/50/200", value: ema, inline: false },
    );

  // ── Hỗ trợ / Kháng cự (levels từ bridge: support/resistance + Fib) ──
  if (sup != null || res != null) {
    const fibs = [lv.fib_382, lv.fib_500, lv.fib_618].filter((v) => v != null).map(num).join(" · ");
    e.addFields({
      name: "Hỗ trợ / Kháng cự",
      value: `🟢 HT: **${num(sup)}**    🔴 KC: **${num(res)}**${fibs ? `\nFib 0.382/0.5/0.618: ${fibs}` : ""}`,
      inline: false,
    });
  }

  // ── Kế hoạch giao dịch TA thuần (từ levels + ATR), luôn có ──
  if (price != null && sup != null && res != null) {
    const entryHi = price > sup ? Math.min(price, sup * 1.03) : price;
    const sl = atr != null ? sup - atr : sup * 0.97; // dưới hỗ trợ ~1×ATR
    const tp1 = res;
    const tp2 = lv.fib_0 != null && lv.fib_0 > res ? lv.fib_0 : res * 1.06;
    const rr = entryHi > sl && tp1 > entryHi ? (tp1 - entryHi) / (entryHi - sl) : null;
    e.addFields({
      name: "Kế hoạch giao dịch (TA)",
      value:
        `🎯 Vùng mua (về hỗ trợ): **${num(sup)}–${num(entryHi)}**\n` +
        `🛑 Cắt lỗ: **${num(sl)}**    🏁 Chốt: TP1 **${num(tp1)}** · TP2 **${num(tp2)}**` +
        (rr != null ? `\n⚖️ Lời/Lỗ ≈ 1:${rr.toFixed(1)}` : ""),
      inline: false,
    });
  }

  e.addFields({
    name: "Tín hiệu",
    value: `${ta.signal || "—"}${ta.bullishScore != null ? ` (Bull ${ta.bullishScore}/Bear ${ta.bearishScore})` : ""}`,
    inline: false,
  });

  // ── Overlay khuyến nghị ADN (chỉ khi tín hiệu còn mới: entry sát giá ±15%) ──
  if (
    signal &&
    signal.entryPrice != null &&
    price != null &&
    price > 0 &&
    Math.abs(signal.entryPrice - price) / price <= 0.15
  ) {
    e.addFields({
      name: "📌 Khuyến nghị ADN",
      value:
        `Điểm mua **${num(signal.entryPrice)}** · Mục tiêu **${num(signal.target)}** · Cắt lỗ **${num(signal.stoploss)}**` +
        (signal.type ? `\n⏱️ Khung: **${signalKindLabel(signal.type)}**` : ""),
      inline: false,
    });
  }

  e.setFooter({ text: BRAND.footer });
  if (Array.isArray(ta.patterns) && ta.patterns.length) {
    e.addFields({ name: "Mẫu hình", value: ta.patterns.join(", ").slice(0, 1024), inline: false });
  }
  const insight = usableInsight(technical.aiInsight);
  if (insight) e.setDescription(insight.slice(0, 4096));
  return e;
}

// ── /ptcb — phân tích cơ bản (data.fundamental từ /api/widget) ──
export function ptcbEmbed(ticker, fundamental = {}) {
  const fa = fundamental.stats || {};
  const x = (v) => (v == null ? "—" : `${num(v)}x`);
  // ROE/ROA từ bridge ở dạng thập phân (0.27 = 27%) → quy ra % khi |v| < 1.
  const p = (v) => (v == null ? "—" : `${num(Math.abs(v) < 1 ? v * 100 : v)}%`);
  const kqkd =
    `DT ${num(fa.revenueLastQ)} tỷ (YoY ${pct(fa.revenueGrowthYoY)})` +
    ` · LN ${num(fa.profitLastQ)} tỷ (YoY ${pct(fa.profitGrowthYoY)})`;
  const e = new EmbedBuilder()
    .setColor(BRAND.color)
    .setTitle(`🏛️ PTCB · ${ticker}`)
    .addFields(
      { name: "P/E", value: x(fa.pe), inline: true },
      { name: "P/B", value: x(fa.pb), inline: true },
      { name: "EPS", value: fa.eps != null ? `${num(fa.eps)} đ/cp` : "—", inline: true },
      { name: "ROE", value: p(fa.roe), inline: true },
      { name: "ROA", value: p(fa.roa), inline: true },
      { name: "Kết quả kinh doanh", value: kqkd, inline: false },
    )
    .setFooter({ text: fa.reportDate ? `Kỳ BC: ${fa.reportDate} · ${BRAND.footer}` : BRAND.footer });
  const insight = usableInsight(fundamental.aiInsight);
  e.setDescription(
    insight ? insight.slice(0, 4096) : "💬 Nhận định AI đang cập nhật — xem số liệu cơ bản phía trên.",
  );
  return e;
}

// ── /tintuc — tin tức theo mã (data.news từ /api/widget) ──
export function newsEmbed(ticker, news = []) {
  const lines = (Array.isArray(news) ? news : [])
    .slice(0, 5)
    .map((n) => {
      const title = String(n.title || "").trim().slice(0, 160) || "(không tiêu đề)";
      const url = n.url || n.link;
      const time = n.time || n.published_at || "";
      const head = url ? `[${title}](${url})` : title;
      return `• ${head}${time ? ` — ${time}` : ""}`;
    });
  return new EmbedBuilder()
    .setColor(BRAND.color)
    .setTitle(`📰 Tin · ${ticker}`)
    .setDescription(lines.join("\n") || `Chưa có tin mới cho ${ticker}.`)
    .setFooter({ text: BRAND.footer });
}

// ── Chào mừng thành viên mới ──
export function welcomeEmbed(member) {
  const name = member.displayName || member.user?.username || "nhà đầu tư";
  const lines = [
    `Chào **${name}** 🤝`,
    "",
    "Để vào cộng đồng: đọc **nội quy** ở kênh này, rồi bấm **✅ Tôi đồng ý nội quy** bên dưới.",
    "Sau khi đồng ý, bạn sẽ **mở khóa toàn bộ kênh** và dùng được **công cụ phân tích** (3 lượt/ngày).",
  ];
  const e = new EmbedBuilder()
    .setColor(BRAND.color)
    .setTitle("👋 Chào mừng tới ADN Capital!")
    .setDescription(lines.join("\n"))
    .setFooter({ text: BRAND.footer });
  const avatar = typeof member.displayAvatarURL === "function" ? member.displayAvatarURL() : null;
  if (avatar) e.setThumbnail(avatar);
  return e;
}

// ── Bản tin sáng / kết phiên (TEXT — thay ảnh) ──
function briefDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}
const tyB = (v) => (v == null ? "—" : `${num(v)} tỷ`);
const joinB = (a) => (Array.isArray(a) && a.length ? a.join(" · ") : "");
const cut = (s) => String(s).slice(0, 1024);

export function eodBriefEmbed(d = {}) {
  const b = d.breadth || {};
  const e = new EmbedBuilder()
    .setColor(dirColor(d.changePct))
    .setTitle(`🌙 Bản tin kết phiên — ${briefDate(d.date)}`)
    .setFooter({ text: BRAND.footer });
  if (d.summary) e.setDescription(cut(d.summary));
  const fields = [
    { name: "VN-INDEX", value: `${num(d.vnindex)} (${pct(d.changePct)})`, inline: true },
    { name: "Thanh khoản", value: tyB(d.totalLiquidity), inline: true },
    { name: "Độ rộng", value: `🟢 ${b.up ?? "—"} / 🔴 ${b.down ?? "—"} / ⚪ ${b.unchanged ?? "—"}`, inline: true },
  ];
  const push = (name, parts) => {
    const v = parts.filter(Boolean).join("\n");
    if (v) fields.push({ name, value: cut(v), inline: false });
  };
  push("Khối ngoại", [d.foreignFlow, joinB(d.foreignTopBuy) && `Mua: ${joinB(d.foreignTopBuy)}`, joinB(d.foreignTopSell) && `Bán: ${joinB(d.foreignTopSell)}`]);
  push("Tự doanh", [joinB(d.propTopBuy) && `Mua: ${joinB(d.propTopBuy)}`, joinB(d.propTopSell) && `Bán: ${joinB(d.propTopSell)}`]);
  push("Cá nhân", [joinB(d.individualTopBuy) && `Mua: ${joinB(d.individualTopBuy)}`, joinB(d.individualTopSell) && `Bán: ${joinB(d.individualTopSell)}`]);
  push("Ảnh hưởng chỉ số", [joinB(d.sectorGainers) && `Kéo: ${joinB(d.sectorGainers)}`, joinB(d.sectorLosers) && `Dìm: ${joinB(d.sectorLosers)}`]);
  push("Tín hiệu chủ động", [joinB(d.buySignals) && `Mua: ${joinB(d.buySignals)}`, joinB(d.sellSignals) && `Bán: ${joinB(d.sellSignals)}`]);
  push("Đột phá / Vượt đỉnh", [joinB([...new Set([...(d.topBreakout || []), ...(d.topNewHigh || [])])])]);
  if (d.outlook) fields.push({ name: "📌 Nhận định phiên tới", value: cut(d.outlook), inline: false });
  e.addFields(fields);
  return e;
}

export function morningBriefEmbed(d = {}) {
  const e = new EmbedBuilder()
    .setColor(BRAND.color)
    .setTitle(`🌅 Bản tin sáng — ${briefDate(d.date)}`)
    .setFooter({ text: BRAND.footer });
  const fields = [];
  const bullets = (a) => cut(a.map((x) => `• ${x}`).join("\n"));
  if (Array.isArray(d.indices) && d.indices.length)
    fields.push({ name: "Chỉ số tham chiếu", value: cut(d.indices.map((i) => `${i.name}: ${num(i.value)} (${pct(i.changePct)})`).join("\n")), inline: false });
  if (Array.isArray(d.market) && d.market.length) fields.push({ name: "Thị trường", value: bullets(d.market), inline: false });
  if (Array.isArray(d.macro) && d.macro.length) fields.push({ name: "Vĩ mô", value: bullets(d.macro), inline: false });
  if (Array.isArray(d.riskOpportunity) && d.riskOpportunity.length) fields.push({ name: "Rủi ro / Cơ hội", value: bullets(d.riskOpportunity), inline: false });
  if (fields.length) e.addFields(fields);
  else e.setDescription("Chưa có dữ liệu bản tin sáng.");
  return e;
}

export function artEmbed(ticker, value, label) {
  return new EmbedBuilder()
    .setColor(BRAND.color)
    .setTitle(`🎯 ADN ART · ${ticker}`)
    .setDescription(
      value == null ? "Chưa có dữ liệu ART cho mã này."
        : `Chỉ số đảo chiều: **${Number(value).toFixed(2)}** / 5${label ? `\nTrạng thái: **${label}**` : ""}`,
    )
    .setFooter({ text: BRAND.footer });
}
