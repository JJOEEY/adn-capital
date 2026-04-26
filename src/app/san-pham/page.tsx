"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { ComponentType } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  FlaskConical,
  Newspaper,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Zap,
} from "lucide-react";
import { BRAND, PRODUCT_DESCRIPTIONS, PRODUCT_NAMES } from "@/lib/brand/productNames";

type ProductCard = {
  href: string;
  title: string;
  eyebrow: string;
  description: string;
  bullets: string[];
  icon: ComponentType<{ className?: string }>;
  badge?: string;
};

const productGroups: { title: string; description: string; items: ProductCard[] }[] = [
  {
    title: "Theo dõi thị trường mỗi ngày",
    description: "Các màn hình giúp khách hàng nắm bức tranh chung trước khi ra quyết định.",
    items: [
      {
        href: "/dashboard",
        title: PRODUCT_NAMES.dashboard,
        eyebrow: "Tổng quan",
        description: PRODUCT_DESCRIPTIONS.dashboard,
        bullets: [
          "Một nơi để xem nhanh trạng thái thị trường",
          "Đọc cùng dữ liệu với web, PWA và notification",
          "Không dùng số liệu placeholder gây hiểu sai",
        ],
        icon: BarChart3,
      },
      {
        href: "/khac/tin-tuc",
        title: "Tin tức",
        eyebrow: "Cập nhật",
        description: "Tổng hợp tin tài chính từ các nguồn chính thống để khách hàng đọc nhanh hơn.",
        bullets: [
          "Bài viết được gom theo nguồn",
          "Tóm tắt nội dung chính",
          "Phù hợp cho người mới theo dõi thị trường",
        ],
        icon: Newspaper,
      },
    ],
  },
  {
    title: "Tìm cơ hội và kiểm tra rủi ro",
    description: "Ngôn ngữ hiển thị tập trung vào hành động dễ hiểu, không ép khách hàng đọc thuật ngữ kỹ thuật.",
    items: [
      {
        href: "/dashboard/signal-map",
        title: PRODUCT_NAMES.brokerWorkflow,
        eyebrow: "Gợi ý cơ hội",
        description: PRODUCT_DESCRIPTIONS.brokerWorkflow,
        bullets: [
          "Tách rõ mã đang quan sát, đang nắm giữ và đã kết thúc",
          "Có vùng mua, mục tiêu và cắt lỗ",
          "AI chỉ giải thích, không tự sinh tín hiệu gốc",
        ],
        icon: Zap,
      },
      {
        href: "/art",
        title: PRODUCT_NAMES.art,
        eyebrow: "Đảo chiều xu hướng",
        description: PRODUCT_DESCRIPTIONS.art,
        bullets: [
          "Dễ đọc bằng đồng hồ điểm",
          "Có lịch sử để so sánh",
          "Không lộ công thức vận hành nội bộ",
        ],
        icon: ShieldCheck,
      },
      {
        href: "/terminal",
        title: PRODUCT_NAMES.advisory,
        eyebrow: "Chat AI",
        description: PRODUCT_DESCRIPTIONS.advisory,
        bullets: [
          "Trả lời theo dữ liệu đang có",
          "Không khẳng định khi thiếu dữ liệu",
          "Phù hợp để kiểm tra thêm trước khi hành động",
        ],
        icon: Bot,
      },
    ],
  },
  {
    title: "Kiểm chứng và học cách dùng",
    description: "Nhóm công cụ giúp khách hàng hiểu phương pháp trước khi dùng tiền thật.",
    items: [
      {
        href: "/backtest",
        title: PRODUCT_NAMES.backtest,
        eyebrow: "Kiểm chứng",
        description: PRODUCT_DESCRIPTIONS.backtest,
        bullets: [
          "Không hứa lợi nhuận tương lai",
          "Giải thích drawdown và kỷ luật vốn",
          "Phù hợp để học quy trình ADN",
        ],
        icon: FlaskConical,
      },
      {
        href: "/hdsd",
        title: "Hướng dẫn sử dụng",
        eyebrow: "Onboarding",
        description: "Tài liệu thao tác từng bước cho khách hàng mới bắt đầu dùng hệ thống.",
        bullets: [
          "Hướng dẫn theo từng sản phẩm",
          "Giải thích các khái niệm chính",
          "Giảm phụ thuộc vào hỗ trợ thủ công",
        ],
        icon: BookOpen,
      },
      {
        href: "/pricing",
        title: "Bảng giá",
        eyebrow: "Gói dịch vụ",
        description: "Chọn gói theo mức độ sử dụng: theo dõi thị trường, nhận gợi ý và dùng AI tư vấn.",
        bullets: [
          "Chỉ gồm các tính năng đang mở công khai",
          "Nêu rõ phạm vi từng gói",
          "Có hướng dẫn kích hoạt sau thanh toán",
        ],
        icon: Sparkles,
      },
    ],
  },
];

const adminOnlyProducts: ProductCard[] = [
  {
    href: "/dashboard/dnse-trading",
    title: PRODUCT_NAMES.brokerConnect,
    eyebrow: "Admin pilot",
    description: "Màn hình thử nghiệm kết nối tài khoản giao dịch. Chỉ hiển thị cho admin cho tới khi pilot ổn định.",
    bullets: [
      "Không public cho khách hàng thường",
      "Dùng để kiểm tra NAV và vị thế thật",
      "Mọi thao tác giao dịch vẫn theo quy trình kiểm soát riêng",
    ],
    icon: WalletCards,
    badge: "ADMIN",
  },
];

function ProductCardView({ item }: { item: ProductCard }) {
  const Icon = item.icon;

  return (
    <Link href={item.href} className="group block h-full">
      <article
        className="flex h-full flex-col rounded-[1.5rem] border p-5 transition duration-200 hover:-translate-y-1"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "0 18px 50px rgba(12, 24, 18, 0.06)",
        }}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl border"
            style={{
              background: "var(--primary-light)",
              borderColor: "var(--border)",
              color: "var(--primary)",
            }}
          >
            <Icon className="h-5 w-5" />
          </span>
          {item.badge ? (
            <span
              className="rounded-full border px-2.5 py-1 text-[11px] font-black"
              style={{ borderColor: "var(--border)", color: "var(--primary)" }}
            >
              {item.badge}
            </span>
          ) : null}
        </div>

        <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
          {item.eyebrow}
        </p>
        <h3 className="mt-2 text-xl font-black tracking-[-0.02em]" style={{ color: "var(--text-primary)" }}>
          {item.title}
        </h3>
        <p className="mt-3 flex-1 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
          {item.description}
        </p>

        <ul className="mt-5 space-y-2">
          {item.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2 text-sm leading-5" style={{ color: "var(--text-secondary)" }}>
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--primary)" }} />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 inline-flex items-center gap-2 text-sm font-black" style={{ color: "var(--primary)" }}>
          Mở sản phẩm
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </div>
      </article>
    </Link>
  );
}

export default function SanPhamPage() {
  const { data: session } = useSession();
  const systemRole = (session?.user as { systemRole?: string } | undefined)?.systemRole;
  const isAdmin = systemRole === "ADMIN";

  return (
    <MainLayout>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <section
          className="overflow-hidden rounded-[2rem] border p-6 sm:p-8 lg:p-10"
          style={{
            background: "linear-gradient(135deg, var(--surface), var(--surface-2))",
            borderColor: "var(--border)",
          }}
        >
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--primary)" }}>
              {BRAND.name.toUpperCase()} TOOLKIT
            </p>
            <h1 className="mt-4 text-3xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">
              Một bộ công cụ đầu tư, dùng cùng một nguồn dữ liệu.
            </h1>
            <p className="mt-4 text-base leading-7" style={{ color: "var(--text-secondary)" }}>
              Trang này gom các sản phẩm chính của ADN theo đúng hành trình sử dụng: theo dõi thị trường, tìm cơ hội,
              kiểm tra rủi ro và học cách vận hành. Các tính năng thử nghiệm nội bộ được ẩn khỏi khách hàng thường.
            </p>
          </div>
        </section>

        {productGroups.map((group) => (
          <section key={group.title} className="space-y-4">
            <div>
              <h2 className="text-2xl font-black tracking-[-0.03em]">{group.title}</h2>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                {group.description}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {group.items.map((item) => (
                <ProductCardView key={item.href} item={item} />
              ))}
            </div>
          </section>
        ))}

        {isAdmin ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-2xl font-black tracking-[-0.03em]">Khu vực admin pilot</h2>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                Các tính năng này chưa public. Chỉ admin thấy để kiểm tra trước khi mở cho khách hàng.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {adminOnlyProducts.map((item) => (
                <ProductCardView key={item.href} item={item} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </MainLayout>
  );
}
