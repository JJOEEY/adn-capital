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
  // Mọi lệnh tra cứu kiểu ADN Stock cùng nằm ở kênh stock-chat (CH_STOCK).
  commandChannels: {
    aiden: opt("CH_AIDEN"),
    stock: opt("CH_STOCK"),
    rank: opt("CH_RANK") || opt("CH_STOCK"),
    art: opt("CH_ART") || opt("CH_STOCK"),
    ptkt: opt("CH_STOCK"),
    ptcb: opt("CH_STOCK"),
    tintuc: opt("CH_STOCK"),
    atc: opt("CH_STOCK"),
  },
  // Bật AIDEN trả lời MỌI tin ở kênh aiden-chat (không cần @tag).
  // CHỈ bật khi đã enable "Message Content Intent" trong Developer Portal, nếu không bot crash.
  aidenListen: opt("AIDEN_LISTEN") === "1",
};

export const BRAND = {
  color: 0x2e4d3d,        // moss — đồng bộ theme web
  up: 0x2e7d4f,
  down: 0xc0392b,
  name: "ADN Capital",
  footer: "ADN Capital · dữ liệu tham khảo, không phải khuyến nghị đầu tư",
};
