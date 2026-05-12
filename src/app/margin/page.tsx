import type { Metadata } from "next";
import MarginPageClient from "./MarginPageClient";

export const metadata: Metadata = {
  title: "Tư Vấn Margin & Đòn Bẩy Tài Chính Đặc Quyền | ADN Capital",
  description:
    "Nhận tư vấn margin và đòn bẩy tài chính đặc quyền cùng ADN Capital. Tối ưu sức mua, quản trị rủi ro bằng ADN ART và quy trình riêng tư cho nhà đầu tư nghiêm túc.",
  alternates: {
    canonical: "/margin",
  },
  openGraph: {
    title: "Tư Vấn Margin & Đòn Bẩy Tài Chính Đặc Quyền | ADN Capital",
    description:
      "Kích hoạt hạn mức margin theo nhu cầu vốn, với kỷ luật quản trị rủi ro và trải nghiệm tư vấn riêng tư từ ADN Capital.",
    url: "https://adncapital.com.vn/margin",
    siteName: "ADN Capital",
    type: "website",
  },
};

const financialProductJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "FinancialProduct",
      name: "Tư vấn Margin & Đòn bẩy tài chính ADN Capital",
      alternateName: "Margin Lending ADN Capital",
      description:
        "Dịch vụ tư vấn vay margin và đòn bẩy tài chính dành cho nhà đầu tư cần tối ưu sức mua, kiểm soát rủi ro và vận hành danh mục có kỷ luật.",
      category: "Margin Lending",
      url: "https://adncapital.com.vn/margin",
      provider: {
        "@type": "FinancialService",
        name: "ADN Capital",
        url: "https://adncapital.com.vn",
      },
      areaServed: {
        "@type": "Country",
        name: "Vietnam",
      },
      feesAndCommissionsSpecification:
        "Lãi suất, hạn mức và điều kiện vay phụ thuộc hồ sơ tài khoản, danh mục chứng khoán và chính sách từng thời điểm.",
      termsOfService:
        "Sản phẩm đòn bẩy tài chính có rủi ro. Nhà đầu tư cần được tư vấn và tự đánh giá khả năng chịu rủi ro trước khi sử dụng.",
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Hạn mức vay Margin tại ADN Capital là bao nhiêu?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Hạn mức vay margin được tư vấn theo vốn tự có, khẩu vị rủi ro, danh mục chứng khoán và điều kiện thị trường tại thời điểm xét duyệt.",
          },
        },
        {
          "@type": "Question",
          name: "Điều kiện để mở tài khoản ký quỹ Margin?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Nhà đầu tư cần có tài khoản chứng khoán hợp lệ, hoàn tất hồ sơ ký quỹ và đáp ứng điều kiện về tài sản bảo đảm, danh mục được phép giao dịch margin.",
          },
        },
        {
          "@type": "Question",
          name: "Lãi suất vay Margin hiện tại?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Lãi suất vay margin phụ thuộc quy mô vốn, chương trình ưu đãi và thời điểm giải ngân. ADN Capital sẽ tư vấn mức phù hợp sau khi nhận thông tin nhu cầu.",
          },
        },
      ],
    },
  ],
};

export default function MarginPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(financialProductJsonLd) }}
      />
      <MarginPageClient />
    </>
  );
}
