/**
 * /design-preview/products/[slug] — product intro pages, same warm UX as the landing.
 * Shared chrome (Shell/Frame/Reveal/theme) + per-product data with real screenshots.
 */

import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, Check, Radar, Gauge, Sparkles, BarChart3, Wallet, Activity, TrendingUp } from "lucide-react";
import { Shell, Reveal, Frame } from "../../theme";

type Product = {
  kicker: string;
  name: string;
  tagline: string;
  desc: string;
  img: string | null;
  icon: typeof Radar;
  features: { t: string; d: string }[];
  related: string[];
};

const PRODUCTS: Record<string, Product> = {
  "aiden": {
    kicker: "Trợ lý AI",
    name: "AIDEN",
    tagline: "Trợ lý AI hiểu thị trường Việt Nam.",
    desc: "AIDEN phân tích cổ phiếu và thị trường bằng dữ liệu thật, trả lời thẳng và có dẫn chứng. Có hai cách dùng cho hai nhu cầu khác nhau: hỏi đáp tự do qua webchat, hoặc xem báo cáo chuẩn hoá ngay trong trang một mã.",
    img: "/hero-showcase/app-aiden.png",
    icon: Sparkles,
    features: [
      { t: "AIDEN webchat: hỏi đáp tự do", d: "Hỏi về một mã hay cả thị trường, AIDEN đọc bối cảnh rồi đưa nhận định, verdict và gợi ý, hỏi lại nếu cần làm rõ. Giọng cố vấn, không máy móc." },
      { t: "AIDEN trong ADN Stock: báo cáo theo mã", d: "Mở một mã ở trang Cổ phiếu, AIDEN dựng báo cáo chuẩn hoá gồm giá, kỹ thuật và vùng quan trọng. Cố định và nhất quán để tra cứu nhanh." },
      { t: "Số liệu thật, không bịa", d: "Phân tích trên dữ liệu thị trường thật, nói rõ chỗ nào chưa có số thay vì đoán." },
      { t: "Trả lời mọi lúc", d: "Hỏi bất kỳ giờ nào, không phải đợi giờ hành chính." },
    ],
    related: ["co-phieu", "art", "rank"],
  },
  "art": {
    kicker: "Chỉ báo",
    name: "Chỉ báo ART",
    tagline: "Biết lúc xu hướng sắp đuối.",
    desc: "ART (Analytical Reversal Tracker) chấm mức cạn kiệt của xu hướng trên thước 0 đến 5. Chỉ số chạm vùng cao là lúc xu hướng dễ đảo chiều, để bạn thoát trước khi giá quay đầu thay vì mua đúng đỉnh.",
    img: "/hero-showcase/app-adn-art-real.png",
    icon: Gauge,
    features: [
      { t: "Một con số duy nhất", d: "Thước 0 đến 5 cho biết xu hướng còn khỏe hay sắp hết hơi." },
      { t: "Vùng đảo chiều rõ ràng", d: "Chạm vùng cảnh báo thì cân nhắc chốt, đừng đu đỉnh." },
      { t: "Hợp mọi mã", d: "Cổ phiếu, phái sinh hay index đều dùng được." },
      { t: "Cập nhật từng nhịp", d: "Theo sát diễn biến giá trong phiên." },
    ],
    related: ["aiden", "co-phieu", "pulse"],
  },
  "co-phieu": {
    kicker: "Tra cứu",
    name: "Cổ phiếu & RS",
    tagline: "Mọi thứ về một mã, trên một trang.",
    desc: "Tra cứu từng cổ phiếu với sức mạnh tương đối (RS), dòng tiền, định giá và lịch sử giá. Đủ để biết mã này đang khỏe hay yếu so với phần còn lại của thị trường.",
    img: "/hero-showcase/app-adn-stock-real.png",
    icon: BarChart3,
    features: [
      { t: "Sức mạnh tương đối (RS)", d: "So mã với cả thị trường, biết nó đang dẫn hay tụt lại." },
      { t: "Dòng tiền vào ra", d: "Tiền lớn đang gom hay xả, nhìn là thấy." },
      { t: "Định giá và cơ bản", d: "P/E, tăng trưởng, số liệu doanh nghiệp gọn một chỗ." },
      { t: "Lịch sử giá", d: "Diễn biến và các mốc quan trọng của mã." },
    ],
    related: ["rank", "art", "aiden"],
  },
  "margin": {
    kicker: "Đòn bẩy",
    name: "Ký quỹ Margin",
    tagline: "Đòn bẩy từ 5,99% một năm, minh bạch.",
    desc: "Vay ký quỹ với lãi suất cạnh tranh, tỷ lệ rõ ràng, theo dõi sức mua tức thời và cảnh báo sớm khi gần call margin. Dùng đòn bẩy có kiểm soát, không bị động.",
    img: null,
    icon: Wallet,
    features: [
      { t: "Lãi suất từ 5,99% / năm", d: "Mức cạnh tranh, tính theo ngày, minh bạch." },
      { t: "Tỷ lệ ký quỹ rõ ràng", d: "Biết chính xác được vay bao nhiêu trên mỗi mã." },
      { t: "Sức mua tức thời", d: "Còn mua được bao nhiêu, cập nhật liên tục." },
      { t: "Cảnh báo call margin sớm", d: "Báo trước khi chạm ngưỡng để bạn kịp xử lý." },
    ],
    related: ["co-phieu", "aiden", "pulse"],
  },
  "pulse": {
    kicker: "Toàn cảnh",
    name: "Nhịp thị trường",
    tagline: "Cả thị trường trên một màn hình.",
    desc: "Index, thanh khoản, độ rộng, dòng tiền ngành và trạng thái vĩ mô gom về một bảng. Mở lên là biết hôm nay thị trường đang thế nào, trước khi xuống tới từng mã.",
    img: "/hero-showcase/app-adn-pulse-real.png",
    icon: Activity,
    features: [
      { t: "Nhịp index và thanh khoản", d: "Thị trường đang khỏe hay yếu, tiền vào nhiều hay ít." },
      { t: "Độ rộng tăng giảm", d: "Bao nhiêu mã tăng, bao nhiêu mã giảm, trần sàn ra sao." },
      { t: "Dòng tiền theo ngành", d: "Ngành nào đang hút tiền, ngành nào đang bị rút." },
      { t: "Điểm vĩ mô", d: "Một con số tóm tắt bối cảnh chung của thị trường." },
    ],
    related: ["aiden", "rank", "art"],
  },
  "rank": {
    kicker: "Xếp hạng",
    name: "Xếp hạng RANK",
    tagline: "Mã nào đang khỏe nhất thị trường?",
    desc: "Xếp hạng cổ phiếu theo sức mạnh tương đối và dòng tiền, để bạn thấy ngay nhóm dẫn dắt thay vì lọc thủ công từng mã.",
    img: "/hero-showcase/app-adn-rank-real.png",
    icon: TrendingUp,
    features: [
      { t: "Xếp theo sức mạnh", d: "Mã khỏe nhất nằm trên cùng, không phải đoán." },
      { t: "Lọc theo ngành", d: "Xem nhóm dẫn dắt trong từng ngành riêng." },
      { t: "Dòng tiền đi kèm", d: "Khỏe vì thật sự có tiền, không phải khỏe ảo." },
      { t: "Cập nhật mỗi phiên", d: "Bảng xếp hạng làm mới sau mỗi phiên giao dịch." },
    ],
    related: ["co-phieu", "pulse", "aiden"],
  },
  "radar": {
    kicker: "Bản đồ tín hiệu",
    name: "ADN Radar",
    tagline: "Cả thị trường trên một bản đồ tín hiệu.",
    desc: "Radar quét toàn sàn mỗi phiên rồi bày ra bản đồ tín hiệu trực quan: mã nào đang Mua, mã nào đang Bán, nhóm ngành nào đang khỏe. Nhìn một màn là nắm cục diện.",
    img: "/hero-showcase/app-adn-radar-real.png",
    icon: Radar,
    features: [
      { t: "Quét toàn sàn mỗi phiên", d: "Rà hết HOSE và HNX, không sót mã đang chạy." },
      { t: "Bản đồ trực quan", d: "Cả thị trường trên một màn, nhóm khỏe nhóm yếu thấy ngay." },
      { t: "Lọc theo trạng thái", d: "Lọc nhanh mã đang Mua, đang Bán hay đang nắm giữ." },
      { t: "Cảnh báo real-time", d: "Tín hiệu mới là báo, khỏi canh bảng cả phiên." },
    ],
    related: ["aiden", "art", "rank"],
  },
};

export function generateStaticParams() {
  return Object.keys(PRODUCTS).map((slug) => ({ slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = PRODUCTS[slug];
  if (!p) notFound();

  const Icon = p.icon;

  return (
    <Shell>
      {/* ── hero ── */}
      <section className="relative overflow-hidden border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[1180px] px-5 pb-16 pt-12 sm:px-8 lg:pb-20 lg:pt-16">
          <Reveal>
            <a href="/design-preview#features" className="dp-mono inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.14em] text-[var(--ink-faint)] transition-colors hover:text-[var(--moss)]">
              <span aria-hidden>←</span> Công cụ
            </a>
          </Reveal>
          <div className="mt-7 grid items-center gap-x-12 gap-y-10 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-6">
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full bg-[var(--mint)] px-3.5 py-1.5">
                  <Icon className="h-4 w-4 text-[var(--moss)]" strokeWidth={1.75} />
                  <span className="dp-mono text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[var(--moss)]">{p.kicker}</span>
                </span>
              </Reveal>
              <Reveal delay={0.05}>
                <h1 className="dp-display mt-5 text-[clamp(2.6rem,4.8vw,4rem)] font-bold leading-[1.04] tracking-[-0.015em]">{p.name}</h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="dp-display mt-3 text-[clamp(1.3rem,2.4vw,1.7rem)] font-medium italic text-[var(--gold)]">{p.tagline}</p>
              </Reveal>
              <Reveal delay={0.14}>
                <p className="mt-6 max-w-[48ch] text-[17px] font-light leading-[1.6] text-[var(--ink-muted)]">{p.desc}</p>
              </Reveal>
              <Reveal delay={0.18}>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <a href="/design-preview/auth?mode=register" className="dp-btn dp-btn-solid dp-btn-lg">Mở tài khoản miễn phí <ArrowRight className="h-4 w-4" strokeWidth={1.75} /></a>
                  <a href="/design-preview#quiz" className="dp-btn dp-btn-ghost dp-btn-lg">Làm bài test phong cách</a>
                </div>
              </Reveal>
            </div>
            <Reveal delay={0.12} className="min-w-0 lg:col-span-6">
              {p.img ? (
                <Frame src={p.img} alt={p.name} ratio="1.7" eager />
              ) : (
                <div className="dp-frame flex items-center justify-center bg-[var(--mint)]" style={{ aspectRatio: "1.7" }}>
                  <Icon className="h-20 w-20 text-[var(--moss)]" strokeWidth={1.25} />
                </div>
              )}
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── features ── */}
      <section className="border-b border-[var(--hairline)] bg-[var(--cream)]">
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 lg:py-24">
          <Reveal>
            <h2 className="dp-display max-w-[16ch] text-[clamp(1.9rem,3.6vw,2.7rem)] font-bold leading-[1.1] tracking-[-0.015em]">Làm được gì <span className="italic text-[var(--gold)]">cho bạn.</span></h2>
          </Reveal>
          <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {p.features.map((f, i) => (
              <Reveal key={f.t} delay={i * 0.06}>
                <div className="border-t border-[var(--gold)] pt-5">
                  <h3 className="dp-display text-[20px] font-semibold tracking-[-0.01em]">{f.t}</h3>
                  <p className="mt-2.5 max-w-[40ch] text-[15px] font-light leading-[1.55] text-[var(--ink-muted)]">{f.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── related ── */}
      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 lg:py-24">
          <Reveal>
            <h2 className="dp-display text-[clamp(1.7rem,3.2vw,2.4rem)] font-bold leading-[1.1] tracking-[-0.015em]">Công cụ <span className="italic text-[var(--gold)]">đi cùng.</span></h2>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {p.related.map((slug2, i) => {
              const r = PRODUCTS[slug2];
              if (!r) return null;
              const RIcon = r.icon;
              return (
                <Reveal key={slug2} delay={i * 0.07}>
                  <a href={`/design-preview/products/${slug2}`} className="dp-tool group flex h-full flex-col rounded-[16px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
                    <div className="flex items-start justify-between">
                      <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--mint)] text-[var(--moss)]"><RIcon className="h-5 w-5" strokeWidth={1.6} /></span>
                      <ArrowUpRight className="h-5 w-5 text-[var(--ink-faint)] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--moss)]" strokeWidth={1.75} />
                    </div>
                    <h3 className="dp-display mt-5 text-[19px] font-semibold tracking-tight">{r.name}</h3>
                    <p className="mt-2 text-[14px] font-light leading-[1.5] text-[var(--ink-muted)]">{r.tagline}</p>
                  </a>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── cta ── */}
      <section>
        <div className="mx-auto max-w-[1180px] px-5 py-24 sm:px-8">
          <Reveal>
            <div className="dp-cta relative overflow-hidden rounded-[28px] px-8 py-20 text-center sm:px-16">
              <h2 className="dp-display mx-auto max-w-[20ch] text-[clamp(2rem,4.2vw,3.2rem)] font-bold leading-[1.06] tracking-[-0.02em] text-[var(--cream)]">
                Đừng vội tin. <span className="italic text-[var(--gold)]">Thử một phiên đi.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-[46ch] text-[17px] font-light leading-[1.55] text-white/75">Mở tài khoản không mất phí, dùng {p.name} cùng cả bộ công cụ trong vài phiên rồi tự thấy có hợp hay không.</p>
              <a href="/design-preview/auth?mode=register" className="dp-btn dp-btn-on-dark dp-btn-lg mt-9">Mở tài khoản ADN <ArrowRight className="h-4 w-4" strokeWidth={1.75} /></a>
            </div>
          </Reveal>
        </div>
      </section>
    </Shell>
  );
}
