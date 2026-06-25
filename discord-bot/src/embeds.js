import { EmbedBuilder } from "discord.js";
import { BRAND } from "./config.js";

const pct = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${Number(v).toFixed(2)}%`);
const num = (v) => (v == null ? "—" : Number(v).toLocaleString("vi-VN", { maximumFractionDigits: 2 }));
const dirColor = (v) => (v == null ? BRAND.color : v >= 0 ? BRAND.up : BRAND.down);

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
export function ptktEmbed(ticker, technical = {}, behavior = {}) {
  const ta = technical.stats || {};
  const p = ta.price || {};
  const ind = ta.indicators || {};
  const tr = ta.trend || {};
  const ema = [ind.ema10, ind.ema50, ind.ema200]
    .map((v) => (v == null ? "—" : num(v)))
    .join(" / ");
  const e = new EmbedBuilder()
    .setColor(dirColor(p.changePct))
    .setTitle(`📊 PTKT · ${ticker}`)
    .addFields(
      { name: "Giá", value: `${num(p.current)} (${pct(p.changePct)})`, inline: true },
      { name: "Xu hướng", value: `${tr.direction || "—"}${tr.adx != null ? ` · ADX ${num(tr.adx)}` : ""}`, inline: true },
      { name: "RSI(14)", value: num(ind.rsi14), inline: true },
      { name: "MACD Hist", value: num(ind.macdHistogram), inline: true },
      { name: "MFI(14)", value: num(ind.mfi14), inline: true },
      { name: "ART (đảo chiều)", value: behavior.teiScore != null ? `${num(behavior.teiScore)} · ${behavior.status || "—"}` : "—", inline: true },
      { name: "EMA 10/50/200", value: ema, inline: false },
      { name: "Tín hiệu", value: `${ta.signal || "—"}${ta.bullishScore != null ? ` (Bull ${ta.bullishScore}/Bear ${ta.bearishScore})` : ""}`, inline: false },
    )
    .setFooter({ text: BRAND.footer });
  if (Array.isArray(ta.patterns) && ta.patterns.length) {
    e.addFields({ name: "Mẫu hình", value: ta.patterns.join(", ").slice(0, 1024), inline: false });
  }
  const insight = (technical.aiInsight || "").trim();
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
  const insight = (fundamental.aiInsight || "").trim();
  e.setDescription((insight || "Đang cập nhật nhận định cơ bản.").slice(0, 4096));
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
