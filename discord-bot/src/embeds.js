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
