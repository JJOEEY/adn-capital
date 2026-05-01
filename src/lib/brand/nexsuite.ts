import { PRODUCT_NAMES, PRODUCT_TAGLINES } from "./productNames";

export type ProductPillar = "Analyst" | "Discipline" | "Network";
export type ProductStatus = "Public" | "Premium" | "Pilot" | "Admin";
export type ProductScene =
  | "pulse"
  | "lens"
  | "radar"
  | "rank"
  | "art"
  | "guard"
  | "vault"
  | "link"
  | "pilot"
  | "lab"
  | "sentinel"
  | "flow"
  | "advisory";

export type ProductModule = {
  slug: string;
  name: string;
  shortName?: string;
  pillar: ProductPillar;
  route: string;
  status: ProductStatus;
  scene: ProductScene;
  outcome: string;
  tagline: string;
  bullets: string[];
  safetyNote?: string;
};

export const PRODUCT_MODULES: ProductModule[] = [
  {
    slug: "nexpulse",
    name: PRODUCT_NAMES.market,
    pillar: "Analyst",
    route: "/dashboard",
    status: "Public",
    scene: "pulse",
    outcome: "Một màn hình để đọc nhịp thị trường trong ngày.",
    tagline: PRODUCT_TAGLINES.market,
    bullets: ["Chỉ số và thanh khoản", "Độ rộng thị trường", "Bản tin và dòng tiền"],
  },
  {
    slug: "nexlens",
    name: PRODUCT_NAMES.stock,
    pillar: "Analyst",
    route: "/stock/HPG",
    status: "Public",
    scene: "lens",
    outcome: "Soi từng cổ phiếu qua cùng một bộ dữ liệu có kiểm soát.",
    tagline: PRODUCT_TAGLINES.stock,
    bullets: ["Kỹ thuật và cơ bản", "Tin tức và tâm lý", "Nhận định AIDEN theo bối cảnh"],
  },
  {
    slug: "nexradar",
    name: PRODUCT_NAMES.signals,
    pillar: "Discipline",
    route: "/dashboard/signal-map",
    status: "Public",
    scene: "radar",
    outcome: "Theo dõi cơ hội mới, tín hiệu đang theo dõi và vị thế đã kết thúc.",
    tagline: PRODUCT_TAGLINES.signals,
    bullets: ["Tín hiệu mới", "Trạng thái theo dõi", "Đồng bộ web, app và thông báo"],
  },
  {
    slug: "nexrank",
    name: PRODUCT_NAMES.rank,
    pillar: "Analyst",
    route: "/rs-rating",
    status: "Premium",
    scene: "rank",
    outcome: "Xếp hạng sức mạnh tương đối để ưu tiên danh sách theo dõi.",
    tagline: PRODUCT_TAGLINES.rank,
    bullets: ["RS theo cổ phiếu", "RS theo danh mục", "Bộ lọc Premium/VIP"],
  },
  {
    slug: "nexart",
    name: PRODUCT_NAMES.art,
    pillar: "Discipline",
    route: "/art",
    status: "Public",
    scene: "art",
    outcome: "Đọc trạng thái hành động, rủi ro và xu hướng mà không lộ công thức.",
    tagline: PRODUCT_TAGLINES.art,
    bullets: ["Gauge trực quan", "Không công khai công thức", "Kiểm tra bối cảnh thị trường"],
  },
  {
    slug: "nexguard",
    name: PRODUCT_NAMES.risk,
    pillar: "Discipline",
    route: "/dashboard/signal-map",
    status: "Admin",
    scene: "guard",
    outcome: "Lớp kiểm soát nội bộ, không hiển thị như một sản phẩm public riêng.",
    tagline: PRODUCT_TAGLINES.risk,
    bullets: ["Vùng giá", "Tỷ trọng tham khảo", "Điểm sai và trạng thái dữ liệu"],
    safetyNote: "ADN Guard đã được ẩn khỏi trang sản phẩm public để tránh trùng điểm đến với ADN ART.",
  },
  {
    slug: "nexvault",
    name: PRODUCT_NAMES.portfolio,
    pillar: "Network",
    route: "/portfolio",
    status: "Public",
    scene: "vault",
    outcome: "Đưa danh mục, vị thế và rủi ro vào cùng một ngữ cảnh.",
    tagline: PRODUCT_TAGLINES.portfolio,
    bullets: ["Danh mục đang nắm giữ", "Tỷ trọng và PnL", "Bối cảnh trước hành động"],
  },
  {
    slug: "nexlink",
    name: PRODUCT_NAMES.broker,
    pillar: "Network",
    route: "/dashboard/dnse-trading",
    status: "Premium",
    scene: "link",
    outcome: "Kết nối tài khoản DNSE, kiểm tra sức mua và đặt lệnh có kiểm soát.",
    tagline: PRODUCT_TAGLINES.broker,
    bullets: ["Tài khoản liên kết", "Tổng tài sản ròng, tiền mặt, sức mua", "Xác thực khi gửi lệnh"],
    safetyNote: "ADN Link luôn kiểm tra điều kiện an toàn trước khi gửi lệnh.",
  },
  {
    slug: "nexpilot",
    name: PRODUCT_NAMES.aiBroker,
    pillar: "Discipline",
    route: "/dashboard/signal-map",
    status: "Admin",
    scene: "radar",
    outcome: "Tên cũ đã được hợp nhất vào ADN Radar trên trang signal-map.",
    tagline: PRODUCT_TAGLINES.aiBroker,
    bullets: ["Tín hiệu trong bối cảnh danh mục", "Kiểm tra trước khi xác nhận", "Không gửi lệnh thật khi chưa đủ điều kiện"],
    safetyNote: "Module này chỉ giữ lại để tương thích đường dẫn cũ; tên public thống nhất là ADN Radar.",
  },
  {
    slug: "nexlab",
    name: PRODUCT_NAMES.backtest,
    pillar: "Analyst",
    route: "/backtest",
    status: "Public",
    scene: "lab",
    outcome: "Kiểm chứng ý tưởng trước khi đưa vào thực chiến.",
    tagline: PRODUCT_TAGLINES.backtest,
    bullets: ["Kịch bản quá khứ", "Drawdown và kỷ luật vốn", "Không hứa lợi nhuận"],
  },
  {
    slug: "nexsentinel",
    name: PRODUCT_NAMES.alerts,
    pillar: "Network",
    route: "/notifications?tab=updates",
    status: "Public",
    scene: "sentinel",
    outcome: "Cảnh báo tín hiệu, rủi ro, bản tin và cập nhật sản phẩm.",
    tagline: PRODUCT_TAGLINES.alerts,
    bullets: ["Thông báo theo GMT+7", "Feed cập nhật", "App và web cùng nguồn"],
  },
  {
    slug: "nexflow",
    name: PRODUCT_NAMES.workflow,
    pillar: "Network",
    route: "/admin/workflows",
    status: "Admin",
    scene: "flow",
    outcome: "Luồng vận hành nội bộ cho brief, signal và cảnh báo.",
    tagline: "Điều phối workflow nội bộ mà không tạo scheduler thứ hai.",
    bullets: ["Trigger có kiểm soát", "Run log", "Chỉ admin vận hành"],
  },
  {
    slug: "aiden-advisory",
    name: PRODUCT_NAMES.advisory,
    shortName: PRODUCT_NAMES.advisoryShort,
    pillar: "Analyst",
    route: "/aiden",
    status: "Public",
    scene: "advisory",
    outcome: "Hỏi thị trường, hỏi mã hoặc hỏi kiến thức đầu tư như một ứng dụng chat.",
    tagline: PRODUCT_TAGLINES.advisory,
    bullets: ["Chat thường", "Phân tích mã khi có dữ liệu", "Không bịa số khi thiếu dữ liệu"],
  },
];

export function getProductModule(slug: string) {
  return PRODUCT_MODULES.find((product) => product.slug === slug);
}

export const PUBLIC_PRODUCT_MODULES = PRODUCT_MODULES.filter((product) => product.status !== "Admin");
