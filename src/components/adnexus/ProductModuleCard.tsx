import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import type { ProductModule } from "@/lib/brand/nexsuite";

export function ProductModuleCard({ product, hrefPrefix = "/products" }: { product: ProductModule; hrefPrefix?: string }) {
  const href = `${hrefPrefix}/${product.slug}`;
  const locked = product.status === "Premium" || product.status === "Admin";

  return (
    <Link
      href={href}
      className="group flex min-h-[270px] flex-col justify-between rounded-[2rem] border bg-white p-6 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/10 dark:bg-white/5"
      style={{ borderColor: "var(--border)" }}
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
            {product.pillar}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase"
            style={{
              background: product.status === "Public" ? "rgba(34,197,94,0.12)" : product.status === "Pilot" ? "rgba(245,158,11,0.14)" : "var(--surface-2)",
              color: product.status === "Public" ? "#059669" : product.status === "Pilot" ? "#d97706" : "var(--text-muted)",
            }}
          >
            {locked ? <Lock className="h-3 w-3" /> : null}
            {product.status}
          </span>
        </div>
        <h3 className="mt-5 text-2xl font-black" style={{ color: "var(--text-primary)" }}>{product.shortName ?? product.name}</h3>
        <p className="mt-3 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>{product.outcome}</p>
      </div>
      <div className="mt-8">
        <div className="grid gap-2">
          {product.bullets.slice(0, 3).map((bullet) => (
            <p key={bullet} className="text-sm" style={{ color: "var(--text-muted)" }}>• {bullet}</p>
          ))}
        </div>
        <div className="mt-6 inline-flex items-center gap-2 text-sm font-black" style={{ color: "var(--primary)" }}>
          Xem chi tiết <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}
