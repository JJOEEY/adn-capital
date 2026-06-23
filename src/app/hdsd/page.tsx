import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { getGuideTree, getFirstSectionHref } from "@/lib/guide";
import s from "./docs.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hướng dẫn sử dụng ADN Capital — Cẩm nang & tài liệu",
  description:
    "Trung tâm hướng dẫn ADN Capital: cách bắt đầu, dùng công cụ phân tích (ART, Composite Score, Radar), AIDEN, quản trị rủi ro và FAQ. Tài liệu rõ ràng cho nhà đầu tư.",
  alternates: { canonical: "/hdsd" },
  openGraph: {
    type: "website",
    title: "Hướng dẫn sử dụng ADN Capital",
    description: "Cẩm nang & tài liệu sử dụng nền tảng ADN Capital cho nhà đầu tư cá nhân.",
    url: "/hdsd",
    siteName: "ADN Capital",
    locale: "vi_VN",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Trang chủ", item: "https://adncapital.com.vn/" },
    { "@type": "ListItem", position: 2, name: "Hướng dẫn sử dụng", item: "https://adncapital.com.vn/hdsd" },
  ],
};

export default async function HdsdHome() {
  const tree = await getGuideTree(false);
  const firstHref = await getFirstSectionHref(false);

  return (
    <div className={s.home}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <p className={s.homeKicker}>Trung tâm hướng dẫn</p>
      <h1 className={s.homeTitle}>Hướng dẫn sử dụng ADN Capital</h1>
      <p className={s.homeLead}>
        Mọi thứ bạn cần để dùng thành thạo nền tảng — từ bước đầu tiên đến các công cụ phân tích,
        AIDEN và nguyên tắc quản trị rủi ro. Đọc theo thứ tự, hoặc tra cứu nhanh ở thanh bên.
      </p>
      {firstHref && (
        <div className={s.homeStart}>
          <Link href={firstHref} className="dp-btn dp-btn-solid dp-btn-lg">
            Bắt đầu đọc <ArrowRight size={16} />
          </Link>
        </div>
      )}

      <div className={s.catGrid}>
        {tree.map((cat) => (
          <div key={cat.id} className={s.catCard}>
            <h2 className={s.catCardTitle}>{cat.title}</h2>
            <div className={s.catCardList}>
              {cat.sections.map((sec) => (
                <Link key={sec.id} href={`/hdsd/${cat.slug}/${sec.slug}`} className={s.catCardLink}>
                  <ChevronRight size={14} style={{ flex: "none", opacity: 0.6 }} />
                  <span>{sec.title}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
