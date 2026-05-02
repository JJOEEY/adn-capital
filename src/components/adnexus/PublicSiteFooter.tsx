import Link from "next/link";
import { BRAND } from "@/lib/brand/productNames";
import { PUBLIC_PRODUCT_MODULES } from "@/lib/brand/nexsuite";

export function PublicSiteFooter() {
  const primaryProducts = PUBLIC_PRODUCT_MODULES.slice(0, 8);

  return (
    <footer
      id="contact"
      className="border-t px-5 py-14 sm:px-8 lg:px-12 xl:px-16"
      style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
    >
      <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
        <div>
          <p className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
            {BRAND.name}
          </p>
          <p className="mt-2 text-sm uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
            {BRAND.tagline}
          </p>
          <p className="mt-5 max-w-md text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
            ADN Capital xây dựng hệ sinh thái AI đầu tư cho nhà đầu tư Việt Nam: đọc thị trường, giữ kỷ luật, theo dõi danh mục và hỏi AIDEN trong cùng một trải nghiệm.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          <FooterColumn
            title="Hệ sinh thái ADN"
            links={primaryProducts.map((product) => ({
              href: `/products/${product.slug}`,
              label: product.shortName ?? product.name,
            }))}
          />
          <FooterColumn
            title="Tài nguyên"
            links={[
              { href: "/pricing", label: "Bảng giá" },
              { href: "/hdsd", label: "Hướng dẫn sử dụng" },
              { href: "/backtest", label: "ADN Lab" },
              { href: "/tin-tuc", label: "Tin tức" },
            ]}
          />
          <FooterColumn
            title="Liên hệ"
            links={[
              { href: "tel:0962977179", label: "0962 977 179" },
              { href: "https://zalo.me/0962977179", label: "Zalo ADN Capital" },
              { href: "/auth", label: "Đăng nhập" },
              { href: "/dashboard", label: "Dùng thử dashboard" },
            ]}
          />
        </div>
      </div>

      <div
        className="mt-10 flex flex-col gap-3 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        <p>© {new Date().getFullYear()} {BRAND.legalName}. Không cam kết lợi nhuận. Tín hiệu chỉ hỗ trợ quyết định.</p>
        <p>62 Hoàng Thế Thiện, Phường An Khánh, TP. Hồ Chí Minh</p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<{ href: string; label: string }> }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
      <div className="mt-4 grid gap-3">
        {links.map((link) => (
          <Link
            key={`${link.href}-${link.label}`}
            href={link.href}
            className="text-sm font-bold hover:underline"
            style={{ color: "var(--text-secondary)" }}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
