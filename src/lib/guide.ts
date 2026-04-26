import { prisma } from "@/lib/prisma";

type GuideSeedSection = {
  title: string;
  slug: string;
  sortOrder: number;
  content: string;
  published?: boolean;
};

type GuideSeedCategory = {
  title: string;
  slug: string;
  sortOrder: number;
  sections: GuideSeedSection[];
};

const GUIDE_DEFAULT_DATA: GuideSeedCategory[] = [
  {
    title: "Bắt đầu",
    slug: "bat-dau",
    sortOrder: 1,
    sections: [
      {
        title: "Giới thiệu ADN Capital",
        slug: "gioi-thieu-adn-capital",
        sortOrder: 1,
        content:
          "## Giới thiệu ADN Capital\n\nADN Capital là nền tảng hỗ trợ nhà đầu tư cá nhân với dữ liệu, phân tích và trợ lý AI.\n\n- Theo dõi thị trường theo thời gian thực\n- Phân tích kỹ thuật/cơ bản theo từng mã\n- Nhận tín hiệu hành động có quản trị rủi ro",
      },
      {
        title: "Hướng dẫn đăng ký tài khoản",
        slug: "huong-dan-dang-ky-tai-khoan",
        sortOrder: 2,
        content:
          "## Hướng dẫn đăng ký tài khoản\n\n1. Bấm **Đăng ký** ở góc phải trên.\n2. Nhập email và mật khẩu.\n3. Xác nhận email (nếu hệ thống yêu cầu).\n4. Đăng nhập để bắt đầu sử dụng.",
      },
      {
        title: "Kết nối tài khoản DNSE",
        slug: "ket-noi-tai-khoan-dnse",
        sortOrder: 3,
        content:
          "## Kết nối DNSE\n\nVào **Hồ sơ** -> **Kết nối DNSE** và điền thông tin xác thực. Sau khi duyệt thành công, hệ thống sẽ mở các tính năng đồng bộ dữ liệu giao dịch.",
      },
    ],
  },
  {
    title: "Công cụ phân tích",
    slug: "cong-cu-phan-tich",
    sortOrder: 2,
    sections: [
      {
        title: "Chỉ báo ART — Analytical Reversal Tracker",
        slug: "chi-bao-art-analytical-reversal-tracker",
        sortOrder: 1,
        content:
          "## Chỉ báo ART\n\nART (Analytical Reversal Tracker) là bộ chỉ báo theo dõi rủi ro đảo chiều theo trạng thái thị trường.\n\n- Giá trị càng cao -> rủi ro càng tăng\n- Nên kết hợp thêm bối cảnh xu hướng và thanh khoản",
      },
      {
        title: "Đọc hiểu ADN Composite Score",
        slug: "doc-hieu-adn-composite-score",
        sortOrder: 2,
        content:
          "## ADN Composite Score\n\nĐiểm tổng hợp từ nhiều thành phần (xu hướng, động lượng, thanh khoản, hành vi dòng tiền).\n\n- Điểm cao: ưu tiên theo dõi cơ hội\n- Điểm thấp: ưu tiên quản trị rủi ro",
      },
      {
        title: "Hướng dẫn dùng NexPilot",
        slug: "huong-dan-dung-adn-ai-broker",
        sortOrder: 3,
        content:
          "## NexPilot\n\nNhập mã cổ phiếu để mở các thẻ phân tích:\n\n- Phân tích kỹ thuật\n- Phân tích cơ bản\n- Tâm lý & hành vi\n- Tin tức & sự kiện",
      },
      {
        title: "Tư vấn đầu tư — Chat với AI",
        slug: "tu-van-dau-tu-chat-voi-ai",
        sortOrder: 4,
        content:
          "## Tư vấn đầu tư\n\nChat với AI để nhận góc nhìn nhanh theo mã cổ phiếu hoặc câu hỏi tự do. Luôn kết hợp với khẩu vị rủi ro cá nhân trước khi ra quyết định.",
      },
    ],
  },
  {
    title: "NexPilot",
    slug: "adn-ai-broker",
    sortOrder: 3,
    sections: [
      {
        title: "Quy trình tham khảo khuyến nghị đầu tư",
        slug: "quy-trinh-tham-khao-khuyen-nghi-dau-tu",
        sortOrder: 1,
        content:
          "## Quy trình tham khảo khuyến nghị\n\n1. Xác định mục tiêu đầu tư.\n2. Đọc đầy đủ luận điểm vào lệnh.\n3. Kiểm tra mức cắt lỗ và tỷ trọng.\n4. Theo dõi kỷ luật theo kế hoạch.",
      },
      {
        title: "Quản lý rủi ro & Stoploss",
        slug: "quan-ly-rui-ro-stoploss",
        sortOrder: 2,
        content:
          "## Quản lý rủi ro\n\n- Không all-in một lệnh.\n- Luôn đặt stoploss trước khi vào lệnh.\n- Ưu tiên sống sót lâu dài hơn lợi nhuận ngắn hạn.",
      },
      {
        title: "Nhật ký giao dịch",
        slug: "nhat-ky-giao-dich",
        sortOrder: 3,
        content:
          "## Nhật ký giao dịch\n\nGhi lại lý do vào/ra lệnh và cảm xúc giao dịch để cải thiện hệ thống cá nhân theo thời gian.",
      },
    ],
  },
  {
    title: "FAQ",
    slug: "faq",
    sortOrder: 4,
    sections: [
      {
        title: "Câu hỏi thường gặp",
        slug: "cau-hoi-thuong-gap",
        sortOrder: 1,
        content:
          "## Câu hỏi thường gặp\n\nNếu gặp lỗi đăng nhập hoặc dữ liệu không hiển thị, kiểm tra kết nối mạng và tải lại trang. Nếu lỗi tiếp diễn, gửi thông tin cho đội hỗ trợ.",
      },
      {
        title: "Liên hệ hỗ trợ",
        slug: "lien-he-ho-tro",
        sortOrder: 2,
        content:
          "## Liên hệ hỗ trợ\n\nLiên hệ đội ngũ ADN Capital qua kênh hỗ trợ chính thức hoặc nhóm Telegram để được xử lý nhanh.",
      },
    ],
  },
];

export function slugifyVi(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function ensureGuideSeeded(): Promise<void> {
  const total = await prisma.guideCategory.count();
  if (total > 0) return;

  await prisma.$transaction(async (tx) => {
    for (const category of GUIDE_DEFAULT_DATA) {
      const dbCategory = await tx.guideCategory.upsert({
        where: { slug: category.slug },
        update: {
          title: category.title,
          sortOrder: category.sortOrder,
        },
        create: {
          title: category.title,
          slug: category.slug,
          sortOrder: category.sortOrder,
        },
      });

      for (const section of category.sections) {
        await tx.guideSection.upsert({
          where: {
            categoryId_slug: {
              categoryId: dbCategory.id,
              slug: section.slug,
            },
          },
          update: {
            title: section.title,
            content: section.content,
            sortOrder: section.sortOrder,
            published: section.published ?? true,
          },
          create: {
            title: section.title,
            slug: section.slug,
            content: section.content,
            sortOrder: section.sortOrder,
            published: section.published ?? true,
            categoryId: dbCategory.id,
          },
        });
      }
    }
  });
}
