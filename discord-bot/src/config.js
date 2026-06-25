import dotenv from "dotenv";
dotenv.config();

function opt(name, fallback = "") {
  return process.env[name] ?? fallback;
}
function req(name) {
  const v = process.env[name];
  if (!v) console.warn(`[config] ⚠️ thiếu env bắt buộc: ${name}`);
  return v ?? "";
}

export const config = {
  token: req("DISCORD_TOKEN"),
  clientId: req("DISCORD_CLIENT_ID"),
  guildId: opt("DISCORD_GUILD_ID"),
  apiBase: opt("ADN_API_BASE", "http://adn-web:3000").replace(/\/+$/, ""),
  internalKey: opt("INTERNAL_API_KEY"),
  channels: {
    signals: opt("CHANNEL_SIGNALS"),
    brief: opt("CHANNEL_BRIEF"),
  },
  roles: {
    premium: opt("ROLE_PREMIUM"),
    vip: opt("ROLE_VIP"),
  },
  // Kênh chỉ định cho từng lệnh (gate "mỗi nơi 1 công cụ"). Trống = cho dùng mọi nơi.
  commandChannels: {
    aiden: opt("CH_AIDEN"),
    stock: opt("CH_STOCK"),
    rank: opt("CH_RANK"),
    art: opt("CH_ART"),
  },
};

export const BRAND = {
  color: 0x2e4d3d,        // moss — đồng bộ theme web
  up: 0x2e7d4f,
  down: 0xc0392b,
  name: "ADN Capital",
  footer: "ADN Capital · dữ liệu tham khảo, không phải khuyến nghị đầu tư",
};
