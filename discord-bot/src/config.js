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
  welcomeChannel: opt("CH_WELCOME"), // kênh chào người mới (GuildMemberAdd)
  rulesChannel: opt("CH_RULES"),     // kênh nội quy (để link trong lời chào)
  roles: {
    premium: opt("ROLE_PREMIUM"),
    vip: opt("ROLE_VIP"),
    signal: opt("ROLE_SIGNAL"),       // role opt-in được @ping khi có tín hiệu mới
    dnse: opt("ROLE_DNSE"),           // khách mở TK DNSE careby ADN (cấp qua duyệt)
    community: opt("ROLE_COMMUNITY"), // guest cộng đồng (tự bấm đồng ý nội quy → auto cấp)
  },
  dnseReviewChannel: opt("CH_DNSE_REVIEW"), // kênh admin nhận & duyệt yêu cầu DNSE
  dnseDailyLimit: Number(opt("DNSE_DAILY_LIMIT", "5")) || 5,          // lượt công cụ/ngày của DNSE
  communityDailyLimit: Number(opt("COMMUNITY_DAILY_LIMIT", "3")) || 3, // lượt công cụ/ngày của guest cộng đồng
  // Kênh chỉ định cho từng lệnh (gate "mỗi nơi 1 công cụ"). Trống = cho dùng mọi nơi.
  // Key = tên slash (đã rút gọn). Mọi lệnh tra cứu kiểu ADN Stock cùng nằm ở stock-chat (CH_STOCK).
  commandChannels: {
    ai: opt("CH_AIDEN"),
    ma: opt("CH_STOCK"),
    top: opt("CH_RANK") || opt("CH_STOCK"),
    art: opt("CH_ART") || opt("CH_STOCK"),
    ta: opt("CH_STOCK"),
    fa: opt("CH_STOCK"),
    tin: opt("CH_STOCK"),
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
