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
  | "advisory"
  | "diary";

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
  demoImage?: string;
  safetyNote?: string;
};

export const PUBLIC_PRODUCT_MODULES: ProductModule[] = [
  {
    slug: "adn-pulse",
    name: "ADN Pulse",
    pillar: "Analyst",
    route: "/dashboard",
    status: "Public",
    scene: "pulse",
    demoImage: "/hero-showcase/app-adn-pulse-real.png",
    outcome: "Nơi tham khảo nhịp đập thị trường trong ngày.",
    tagline:
      "ADN Pulse gom chỉ số, độ rộng, thanh khoản, dòng tiền và trạng thái ADNCore vào một màn hình để anh/chị biết thị trường đang khỏe, đang phân hóa hay cần thận trọng.",
    bullets: ["Chỉ số và độ rộng thị trường", "Dòng tiền nhà đầu tư", "Top biến động và trạng thái rủi ro"],
  },
  {
    slug: "adn-stock",
    name: "ADN Stock",
    pillar: "Analyst",
    route: "/stock/VHM",
    status: "Public",
    scene: "lens",
    demoImage: "/hero-showcase/app-adn-stock-real.png",
    outcome: "Tra cứu từng cổ phiếu cùng biểu đồ, định giá và AIDEN.",
    tagline:
      "ADN Stock đặt giá, thanh khoản, vùng kỹ thuật, chỉ số cơ bản và phần giải thích của AIDEN vào cùng một khung nhìn để anh/chị hiểu bối cảnh trước khi hành động.",
    bullets: ["Biểu đồ và vùng giá", "Định giá cơ bản", "AIDEN giải thích bằng dữ liệu"],
  },
  {
    slug: "adn-radar",
    name: "ADN Radar",
    pillar: "Discipline",
    route: "/dashboard/signal-map",
    status: "Public",
    scene: "radar",
    demoImage: "/hero-showcase/app-adn-radar-real.png",
    outcome: "Theo dõi các tín hiệu đáng chú ý trong phiên.",
    tagline:
      "ADN Radar giúp anh/chị biết mã nào cần quan sát kỹ hơn, tín hiệu nào cần chờ xác nhận thêm và không phải nhìn bảng giá cả ngày.",
    bullets: ["Tín hiệu nổi bật", "Theo dõi trong phiên", "Kỷ luật trước khi ra quyết định"],
  },
  {
    slug: "adn-rank",
    name: "ADN Rank",
    pillar: "Analyst",
    route: "/rs-rating",
    status: "Public",
    scene: "rank",
    demoImage: "/hero-showcase/app-adn-rank-real.png",
    outcome: "Bảng xếp hạng sức mạnh cổ phiếu và nhóm ngành.",
    tagline:
      "ADN Rank giúp anh/chị bắt đầu từ nơi dòng tiền đang thể hiện rõ hơn: cổ phiếu khỏe, nhóm ngành khỏe và sự thay đổi sức mạnh qua nhiều phiên.",
    bullets: ["Xếp hạng cổ phiếu", "Xếp hạng nhóm ngành", "Timeline sức mạnh nhiều phiên"],
  },
  {
    slug: "adn-art",
    name: "ADN ART",
    pillar: "Discipline",
    route: "/art",
    status: "Public",
    scene: "art",
    demoImage: "/hero-showcase/app-adn-art-real.png",
    outcome: "Theo dõi xu hướng đảo chiều để nhận biết vùng mua, vùng bán.",
    tagline:
      "ADN ART là lớp quan sát khi thị trường bắt đầu đổi nhịp: sau một đoạn giảm dài, sau một nhịp tăng nóng hoặc khi cổ phiếu chạm vùng quan trọng.",
    bullets: ["Điểm đảo chiều", "Vùng rủi ro", "Trạng thái hành động"],
  },
  {
    slug: "adn-diary",
    name: "ADN Diary",
    pillar: "Discipline",
    route: "/journal",
    status: "Public",
    scene: "diary",
    demoImage: "/hero-showcase/app-adn-diary-real.png",
    outcome: "Nơi ghi lại giao dịch, lý do vào lệnh và cảm xúc thật.",
    tagline:
      "ADN Diary giúp anh/chị nhìn lại mình mua vì kế hoạch hay vì cảm xúc, thường sai ở đâu và cần sửa điều gì trước khi tăng quy mô vốn.",
    bullets: ["Nhật ký mua bán", "Lý do và cảm xúc", "AI đọc lại hành vi giao dịch"],
  },
];

export const PRODUCT_MODULES: ProductModule[] = PUBLIC_PRODUCT_MODULES;

export function getProductModule(slug: string) {
  return PUBLIC_PRODUCT_MODULES.find((product) => product.slug === slug);
}
