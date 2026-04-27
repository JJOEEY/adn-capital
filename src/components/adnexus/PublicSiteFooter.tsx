import Link from "next/link";
import { BRAND } from "@/lib/brand/productNames";
import { PRODUCT_MODULES } from "@/lib/brand/nexsuite";

export function PublicSiteFooter() {
  const primaryProducts = PRODUCT_MODULES.filter((product) => product.status !== "Admin").slice(0, 8);

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
            ADN Capital xay dung he sinh thai AI dau tu cho nha dau tu Viet Nam: doc thi truong, giu ky luat, theo doi danh muc va hoi AIDEN trong cung mot trai nghiem.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          <FooterColumn
            title="He sinh thai ADN"
            links={primaryProducts.map((product) => ({
              href: `/products/${product.slug}`,
              label: product.shortName ?? product.name,
            }))}
          />
          <FooterColumn
            title="Tai nguyen"
            links={[
              { href: "/pricing", label: "Bang gia" },
              { href: "/hdsd", label: "Huong dan su dung" },
              { href: "/backtest", label: "ADN Lab" },
              { href: "/khac/tin-tuc", label: "Tin tuc" },
            ]}
          />
          <FooterColumn
            title="Lien he"
            links={[
              { href: "tel:0962977179", label: "0962 977 179" },
              { href: "https://zalo.me/0962977179", label: "Zalo ADN Capital" },
              { href: "/auth", label: "Dang nhap" },
              { href: "/dashboard", label: "Dung thu dashboard" },
            ]}
          />
        </div>
      </div>

      <div
        className="mt-10 flex flex-col gap-3 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        <p>© {new Date().getFullYear()} {BRAND.legalName}. Khong cam ket loi nhuan. Tin hieu chi ho tro quyet dinh.</p>
        <p>62 Hoang The Thien, Phuong An Khanh, TP. Ho Chi Minh</p>
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
