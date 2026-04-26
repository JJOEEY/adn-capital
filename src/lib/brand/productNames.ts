export const BRAND = {
  company: "ADN Capital",
  platform: "ADNexus",
  aiPersona: "AIDEN",
  name: "ADNexus",
  legalName: "ADN Capital",
  tagline: "Analyst. Discipline. Network.",
  positioning: "Hệ điều hành đầu tư AI cho chứng khoán Việt Nam.",
  persona: "AIDEN",
} as const;

export const PRODUCT_NAMES = {
  platform: "ADNexus",
  assistant: "AIDEN Analyst",
  advisory: "ADN Advisory powered by AIDEN",
  advisoryShort: "AIDEN Advisory",
  market: "NexPulse",
  dashboard: "NexPulse",
  stock: "NexLens",
  workbench: "NexLens",
  signals: "NexRadar",
  signalMap: "NexRadar",
  rank: "NexRank",
  rsRating: "NexRank",
  art: "NexART",
  risk: "NexGuard",
  guardrails: "NexGuard",
  portfolio: "NexVault",
  broker: "NexLink",
  brokerConnect: "NexLink",
  aiBroker: "NexPilot",
  brokerWorkflow: "NexPilot",
  backtest: "NexLab",
  alerts: "NexSentinel",
  notifications: "NexSentinel",
  workflow: "NexFlow",
  brief: "AIDEN Brief",
  diary: "NexDiary",
} as const;

export const PRODUCT_TAGLINES = {
  platform: "Hệ điều hành đầu tư AI cho chứng khoán Việt Nam.",
  market: "Đọc nhịp thị trường Việt Nam.",
  stock: "Soi từng cổ phiếu qua dữ liệu, AI và tín hiệu.",
  signals: "Theo dõi bản đồ cơ hội và vòng đời tín hiệu.",
  rank: "Xếp hạng sức mạnh tương đối của cổ phiếu.",
  art: "Action • Risk • Trend — đo hướng, rủi ro và trạng thái hành động.",
  risk: "Giữ kỷ luật rủi ro trước khi hành động.",
  portfolio: "Quản trị danh mục, tài sản và rủi ro.",
  broker: "Kết nối tài khoản và đồng bộ trạng thái giao dịch.",
  aiBroker: "Preview hành động giao dịch qua lớp kiểm soát.",
  backtest: "Kiểm chứng chiến lược trước khi thực chiến.",
  alerts: "Cảnh báo tín hiệu, rủi ro và workflow.",
  advisory: "Tư vấn đầu tư kết hợp AI, dữ liệu và chuyên gia ADN.",
} as const;

export const PRODUCT_DESCRIPTIONS = {
  dashboard: "Bức tranh thị trường, thanh khoản, độ rộng và bản tin trong ngày.",
  workbench: "Không gian phân tích từng mã cổ phiếu theo dữ liệu đang có.",
  signalMap: "Bản đồ tín hiệu được đồng bộ từ cùng nguồn với Telegram và app.",
  rsRating: "Xếp hạng sức mạnh tương đối của cổ phiếu và danh mục theo nguồn chuẩn.",
  art: "Action - Risk - Trend: theo dõi đảo chiều và trạng thái rủi ro.",
  guardrails: "Các giới hạn an toàn giúp giữ kỷ luật trước khi hành động.",
  portfolio: "Theo dõi danh mục, vị thế và trạng thái lãi lỗ.",
  brokerConnect: "Kết nối broker ở chế độ pilot, chưa public cho khách hàng thường.",
  brokerWorkflow: "Theo dõi cơ hội, trạng thái và hành động đề xuất có kiểm soát.",
  backtest: "Kiểm chứng ý tưởng trên dữ liệu quá khứ trước khi áp dụng.",
  notifications: "Thông báo, cảnh báo và nhật ký cập nhật sản phẩm.",
  workflow: "Luồng tự động hóa nội bộ cho brief, signal và cảnh báo.",
  brief: "Bản tin AI đọc từ dữ liệu thị trường và tin tức đã chuẩn hóa.",
  advisory: "Trợ lý hội thoại đầu tư, hỗ trợ chat thường và phân tích mã.",
  diary: "Nhật ký giao dịch và các ghi chú theo dõi hành động đầu tư.",
} as const;

export const ROUTE_DISPLAY_NAMES: Record<string, { title: string; breadcrumb: string }> = {
  "/": { title: BRAND.name, breadcrumb: BRAND.positioning },
  "/dashboard": { title: PRODUCT_NAMES.dashboard, breadcrumb: "Trang chủ - Tổng quan thị trường" },
  "/art": { title: PRODUCT_NAMES.art, breadcrumb: "Sản phẩm - Action - Risk - Trend" },
  "/terminal": { title: PRODUCT_NAMES.advisory, breadcrumb: "Sản phẩm - Tư vấn đầu tư" },
  "/dashboard/signal-map": { title: PRODUCT_NAMES.brokerWorkflow, breadcrumb: "Sản phẩm - Broker workflow" },
  "/dashboard/dnse-trading": { title: PRODUCT_NAMES.brokerConnect, breadcrumb: "Admin pilot - Broker connect" },
  "/rs-rating": { title: PRODUCT_NAMES.rsRating, breadcrumb: "Sản phẩm - Xếp hạng sức mạnh" },
  "/margin": { title: "Ký quỹ - Mua nhanh", breadcrumb: "Dịch vụ - Ký quỹ" },
  "/journal": { title: PRODUCT_NAMES.diary, breadcrumb: `Dịch vụ - ${PRODUCT_NAMES.diary}` },
  "/pricing": { title: "Bảng giá", breadcrumb: "Khác - Gói dịch vụ" },
  "/backtest": { title: PRODUCT_NAMES.backtest, breadcrumb: "Khác - Kiểm chứng chiến thuật" },
  "/hdsd": { title: "Hướng dẫn sử dụng", breadcrumb: "Khác - Onboarding" },
  "/profile": { title: "Tài khoản", breadcrumb: "Tài khoản - Thông tin cá nhân" },
  "/admin": { title: "Quản lý hệ thống", breadcrumb: "Hệ thống - Admin" },
  "/san-pham": { title: "Sản phẩm", breadcrumb: `${BRAND.name} - Bộ công cụ` },
  "/tin-tuc": { title: "Tin tức", breadcrumb: "Tin tức - Cập nhật thị trường" },
  "/khac/tin-tuc": { title: "Tin tức", breadcrumb: "Tin tức - Cập nhật thị trường" },
  "/notifications": { title: PRODUCT_NAMES.notifications, breadcrumb: "Thông báo - Cảnh báo và cập nhật" },
  "/menu": { title: "Menu", breadcrumb: `${BRAND.name} - Tài khoản và dịch vụ` },
};

export function getRouteDisplay(pathname: string) {
  if (ROUTE_DISPLAY_NAMES[pathname]) return ROUTE_DISPLAY_NAMES[pathname];

  const match = Object.entries(ROUTE_DISPLAY_NAMES)
    .filter(([route]) => route !== "/" && pathname.startsWith(`${route}/`))
    .sort(([a], [b]) => b.length - a.length)[0];

  return match?.[1] ?? { title: BRAND.name, breadcrumb: BRAND.positioning };
}
