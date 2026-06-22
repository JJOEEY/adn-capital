import type { Metadata } from "next";
import MarginPageClient from "./MarginPageClient";

export const metadata: Metadata = {
  title: "Margin Chứng Khoán — Vay Ký Quỹ Lãi Suất 5.99% | ADN Capital",
  description:
    "Tìm hiểu margin chứng khoán từ A–Z: cách tính margin call, rủi ro, lãi suất thị trường và giải pháp vay ký quỹ lãi suất từ 5.99%/năm tại ADN Capital. Tư vấn miễn phí.",
  alternates: {
    canonical: "/margin",
  },
  openGraph: {
    type: "article",
    title: "Margin Chứng Khoán — Vay Ký Quỹ Lãi Suất 5.99% | ADN Capital",
    description:
      "Cẩm nang margin chứng khoán: cách hoạt động, margin call, rủi ro và lãi suất vay ký quỹ từ 5.99%/năm tại ADN Capital.",
    url: "/margin",
    siteName: "ADN Capital",
    locale: "vi_VN",
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Margin chứng khoán: hiểu cho đúng trước khi vay",
  description:
    "Cẩm nang margin chứng khoán: cách vay ký quỹ hoạt động, cách tính margin call, rủi ro đòn bẩy và so sánh lãi suất thị trường với mức từ 5.99%/năm tại ADN Capital.",
  inLanguage: "vi-VN",
  author: { "@type": "Organization", name: "ADN Capital" },
  publisher: { "@type": "Organization", name: "ADN Capital", url: "https://adncapital.com.vn" },
  datePublished: "2026-01-01",
  dateModified: "2026-06-22",
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://adncapital.com.vn/margin" },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Trang chủ", item: "https://adncapital.com.vn/" },
    { "@type": "ListItem", position: 2, name: "Margin chứng khoán", item: "https://adncapital.com.vn/margin" },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Margin chứng khoán có hợp pháp tại Việt Nam không?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Có. Được quy định tại Thông tư 121/2020/TT-BTC, do UBCKNN cấp phép và giám sát.",
      },
    },
    {
      "@type": "Question",
      name: "Tỉ lệ ký quỹ tối thiểu theo quy định là bao nhiêu?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Tỉ lệ cho vay tối đa không vượt 50% giá trị chứng khoán được phép margin. Mỗi CTCK có thể áp dụng khác nhau.",
      },
    },
    {
      "@type": "Question",
      name: "Lãi suất margin tính như thế nào?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Lãi ngày = Dư nợ × (Lãi suất/năm ÷ 365). Tích lũy hàng ngày, thu theo định kỳ tùy CTCK.",
      },
    },
    {
      "@type": "Question",
      name: "Margin call xảy ra khi nào?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Khi giá trị tài sản ròng (danh mục - dư nợ) giảm dưới ngưỡng ký quỹ duy trì tối thiểu. Không xử lý kịp, CTCK có thể bán giải chấp.",
      },
    },
    {
      "@type": "Question",
      name: "Có nên dùng margin cho nhà đầu tư mới không?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Không khuyến nghị. Đòn bẩy khuếch đại cả lợi nhuận lẫn thua lỗ. Cần nắm vững phân tích và quản lý vốn trước.",
      },
    },
    {
      "@type": "Question",
      name: "ADN Capital hỗ trợ những cổ phiếu nào được margin?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Cổ phiếu HOSE và HNX đủ điều kiện thanh khoản và vốn hóa theo quy định UBCKNN. Liên hệ ADN Capital để nhận danh sách hiện hành.",
      },
    },
  ],
};

export default function MarginPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <MarginPageClient />
    </>
  );
}
