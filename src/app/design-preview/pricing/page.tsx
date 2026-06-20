/**
 * /design-preview/pricing — membership tiers (ADN Base / VIP / Premium), same warm UX.
 * Tiers + copy mirror the existing site; no invented prices (access is period-based).
 */

import { Fragment } from "react";
import { ArrowRight, Check, Minus, ChevronDown } from "lucide-react";
import { Shell, Reveal } from "../theme";
import { PayButton } from "../PayButton";

const dong = (n: number) => `${n.toLocaleString("vi-VN")}đ`;

type CellVal = boolean | string;
const COMPARE: { group: string; rows: { label: string; base: CellVal; vip: CellVal; premium: CellVal }[] }[] = [
  {
    group: "Dữ liệu thị trường",
    rows: [
      { label: "Nhịp thị trường (Pulse)", base: true, vip: true, premium: true },
      { label: "Dữ liệu giá", base: "EOD", vip: "Realtime", premium: "Realtime" },
      { label: "Nhật ký giao dịch", base: true, vip: true, premium: true },
    ],
  },
  {
    group: "Công cụ phân tích",
    rows: [
      { label: "AIDEN (trợ lý AI)", base: "Giới hạn", vip: "Đầy đủ", premium: "Đầy đủ" },
      { label: "ADN Stock (phân tích mã)", base: "Cơ bản", vip: "Đầy đủ", premium: "Đầy đủ" },
      { label: "ADN Radar (tín hiệu Mua/Bán)", base: false, vip: true, premium: true },
      { label: "Chỉ báo ART", base: false, vip: true, premium: true },
      { label: "Xếp hạng RANK", base: false, vip: true, premium: true },
      { label: "ADN Lab", base: false, vip: true, premium: true },
      { label: "Cảnh báo tín hiệu real-time", base: false, vip: true, premium: true },
    ],
  },
  {
    group: "Hỗ trợ & thời hạn",
    rows: [
      { label: "Ưu tiên hỗ trợ", base: false, vip: true, premium: true },
      { label: "Thời hạn", base: "3 tháng", vip: "6 tháng", premium: "12 tháng" },
    ],
  },
];

function CompareCell({ v, featured = false }: { v: CellVal; featured?: boolean }) {
  return (
    <td className={`px-3 py-3.5 text-center align-middle ${featured ? "bg-[color-mix(in_srgb,var(--mint)_55%,transparent)]" : ""}`}>
      {v === true ? (
        <Check className="mx-auto h-[18px] w-[18px] text-[var(--moss)]" strokeWidth={2.5} />
      ) : v === false ? (
        <Minus className="mx-auto h-[18px] w-[18px] text-[var(--ink-faint)] opacity-50" strokeWidth={2} />
      ) : (
        <span className="text-[13.5px] font-medium">{v}</span>
      )}
    </td>
  );
}

const PLANS = [
  {
    num: "01",
    name: "ADN Base",
    period: "3 tháng",
    focus: "Làm quen có kỷ luật",
    short: "Base",
    tagline: "Gieo hạt đầu tiên",
    tag: "Cơ bản",
    tier: "base",
    featured: false,
    price: 649000,
    planId: "3m",
    desc: "VIP 3 tháng ADN Capital",
    bullets: ["Nhịp thị trường và dữ liệu giá EOD", "ADN Stock bản cơ bản", "Nhật ký giao dịch", "AIDEN bản giới hạn"],
  },
  {
    num: "02",
    name: "ADN VIP",
    period: "6 tháng",
    focus: "Dùng công cụ hằng ngày",
    short: "VIP",
    tagline: "Cây non vươn cành",
    tag: "Phổ biến",
    tier: "vip",
    featured: true,
    price: 1199000,
    planId: "6m",
    desc: "VIP 6 tháng ADN Capital",
    bullets: ["Mở khoá AIDEN, Radar, ART, RANK", "ADN Stock và ADN Lab đầy đủ", "Dữ liệu và cảnh báo realtime", "Ưu tiên hỗ trợ"],
  },
  {
    num: "03",
    name: "ADN Premium",
    period: "12 tháng",
    focus: "Theo sát phương pháp",
    short: "Premium",
    tagline: "Cây trưởng thành, đơm hoa",
    tag: "Chuyên sâu",
    tier: "premium",
    featured: false,
    price: 1999000,
    planId: "12m",
    desc: "VIP 12 tháng ADN Capital",
    bullets: ["Toàn bộ công cụ như gói VIP", "Ưu tiên hỗ trợ riêng", "Thời hạn 12 tháng, lợi nhất theo tháng"],
  },
];

const FAQ = [
  { q: "Mở tài khoản có mất phí không?", a: "Không. Đăng ký ADN bằng Google là miễn phí, kèm 7 ngày dùng thử gói VIP để bạn trải nghiệm đầy đủ công cụ trước khi quyết định trả phí." },
  { q: "Ba gói khác nhau ở điểm nào?", a: "Base hợp người mới: xem dữ liệu cơ bản và tập ghi nhật ký. VIP mở khoá toàn bộ công cụ (AIDEN, Radar, ART, RANK) cho người dùng hằng ngày. Premium đủ công cụ như VIP nhưng thời hạn 12 tháng và ưu tiên hỗ trợ. Bảng so sánh phía trên liệt kê từng quyền lợi." },
  { q: "Thanh toán bằng cách nào?", a: "Bấm Thanh toán ở gói bạn chọn, hệ thống tạo mã QR qua PayOS. Quét bằng app ngân hàng bất kỳ là xong, không phải nhập số thẻ." },
  { q: "Bao lâu sau khi trả thì dùng được?", a: "Gần như ngay lập tức. Khi PayOS xác nhận giao dịch, quyền dùng tự bật theo tài khoản, không phải chờ duyệt tay." },
  { q: "Quyền dùng tính thế nào, có tự gia hạn không?", a: "Theo tài khoản ADN, rõ ngày bắt đầu và ngày hết hạn. Hết hạn thì bạn chủ động gia hạn; hệ thống không tự trừ tiền hay tự gia hạn." },
  { q: "Đang dùng dở muốn nâng gói thì sao?", a: "Nâng lúc nào cũng được. Phần thời gian còn lại của gói cũ được quy đổi sang gói mới, bạn chỉ bù phần chênh lệch." },
  { q: "Có ưu đãi hay mã giới thiệu không?", a: "Có. Mở tài khoản chứng khoán DNSE qua link giới thiệu của ADN được ưu đãi tới 40% học phí. Nhập mã lúc thanh toán, ADN duyệt rồi áp giá ưu đãi cho bạn." },
  { q: "Không hợp thì có hoàn tiền không?", a: "Hãy tận dụng 7 ngày dùng thử VIP miễn phí để xem có hợp không trước khi mua. Trường hợp đặc biệt sau khi đã thanh toán, liên hệ ADN để được hỗ trợ." },
];

/* growth art per tier: a plant from sprout to flowering — the member's journey */
function Leaf({ x, y, rot, s = 1 }: { x: number; y: number; rot: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}) scale(${s})`}>
      <path d="M0,0 C18,-12 42,-9 54,5 C40,18 14,16 0,0 Z" fill="var(--leaf-fill)" stroke="var(--leaf)" strokeWidth={3} strokeLinejoin="round" />
      <path d="M6,2 C22,3 38,5 47,7" fill="none" stroke="var(--leaf)" strokeWidth={1.5} strokeOpacity={0.65} strokeLinecap="round" />
    </g>
  );
}

function PlanArt({ tier }: { tier: string }) {
  if (tier === "base") {
    return (
      <svg viewBox="0 0 200 210" className="h-[150px] w-auto" fill="none" aria-hidden>
        <path d="M46 184 Q100 172 154 184" stroke="var(--ground)" strokeWidth={4} strokeLinecap="round" />
        <path d="M100 182 C97 152 103 122 100 86" stroke="var(--stem)" strokeWidth={6} strokeLinecap="round" />
        <circle cx={100} cy={182} r={6} fill="var(--stem)" />
        <circle cx={100} cy={84} r={7.5} fill="var(--stem)" />
        <Leaf x={99} y={128} rot={202} />
        <Leaf x={101} y={140} rot={-22} />
      </svg>
    );
  }
  if (tier === "vip") {
    return (
      <svg viewBox="0 0 200 234" className="h-[186px] w-auto" fill="none" aria-hidden>
        <path d="M52 206 Q100 196 148 206" stroke="var(--ground)" strokeWidth={4} strokeLinecap="round" />
        <path d="M100 204 C98 160 102 110 100 56" stroke="var(--stem)" strokeWidth={6} strokeLinecap="round" />
        <circle cx={100} cy={204} r={5.5} fill="var(--stem)" />
        <Leaf x={100} y={168} rot={200} />
        <Leaf x={100} y={150} rot={-20} />
        <Leaf x={100} y={126} rot={202} s={0.92} />
        <Leaf x={100} y={108} rot={-22} s={0.92} />
        <Leaf x={100} y={86} rot={204} s={0.8} />
        <Leaf x={100} y={70} rot={-24} s={0.8} />
        <circle cx={100} cy={54} r={6.5} fill="var(--stem)" />
      </svg>
    );
  }
  const petals = [0, 60, 120, 180, 240, 300].map((a) => {
    const rad = (a * Math.PI) / 180;
    return <circle key={a} cx={100 + Math.cos(rad) * 15} cy={86 + Math.sin(rad) * 15} r={11} fill="var(--flower)" />;
  });
  return (
    <svg viewBox="0 0 200 244" className="h-[198px] w-auto" fill="none" aria-hidden>
      <circle cx={100} cy={92} r={66} stroke="var(--halo)" strokeWidth={1.5} />
      <path d="M52 216 Q100 206 148 216" stroke="var(--ground)" strokeWidth={4} strokeLinecap="round" />
      <path d="M100 214 C98 176 102 132 100 98" stroke="var(--stem)" strokeWidth={6} strokeLinecap="round" />
      <circle cx={100} cy={214} r={5.5} fill="var(--stem)" />
      <Leaf x={100} y={182} rot={200} s={0.95} />
      <Leaf x={100} y={164} rot={-20} s={0.95} />
      <Leaf x={100} y={142} rot={202} s={0.85} />
      <Leaf x={100} y={124} rot={-22} s={0.85} />
      {petals}
      <circle cx={100} cy={86} r={10} fill="var(--flower-center)" />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <Shell>
      {/* ── hero ── */}
      <section className="relative overflow-hidden border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[1180px] px-5 pb-12 pt-16 text-center sm:px-8 lg:pt-20">
          <Reveal>
            <p className="dp-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">Gói thành viên</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="dp-display mx-auto mt-5 max-w-[18ch] text-[clamp(2.5rem,4.8vw,3.8rem)] font-bold leading-[1.05] tracking-[-0.02em]">
              Chọn gói theo <span className="italic text-[var(--gold)]">cách bạn dùng.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-6 max-w-[52ch] text-[18px] font-light leading-[1.55] text-[var(--ink-muted)]">
              Bắt đầu miễn phí với 7 ngày VIP. Hợp rồi thì chọn thời hạn, quyền dùng quản lý theo tài khoản, rõ ngày bắt đầu và kết thúc.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── plans ── */}
      <section className="border-b border-[var(--hairline)] bg-[var(--cream)]">
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 lg:py-24">
          <p className="mb-8 text-center text-[13.5px] font-light text-[var(--ink-faint)] lg:hidden">Chạm để xem chi tiết từng gói.</p>
          <p className="mb-8 hidden text-center text-[13.5px] font-light text-[var(--ink-faint)] lg:block">Di chuột vào từng gói để xem chi tiết hỗ trợ.</p>
          <div className="grid gap-5 lg:grid-cols-3">
            {PLANS.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.07}>
                <div className={`dp-flip ${p.featured ? "dp-flip-feat" : ""}`}>
                  <div className="dp-flip-inner">
                    {/* front cover */}
                    <div className={`dp-flip-front dp-cover-${p.tier}`}>
                      <div className="flex items-start justify-between">
                        <span className="dp-mono text-[12px] tracking-[0.18em] opacity-60">/ {p.num}</span>
                        <span className="dp-mono rounded-md border border-current px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] opacity-90">{p.tag}</span>
                      </div>
                      <div className="flex grow items-center justify-center py-2">
                        <PlanArt tier={p.tier} />
                      </div>
                      <div className="text-center">
                        <p className="dp-mono text-[11.5px] uppercase tracking-[0.18em] opacity-55">{p.focus}</p>
                        <p className="dp-display text-[15px] font-medium leading-none opacity-65">ADN</p>
                        <h2 className="dp-display text-[42px] font-bold leading-[1.0]">{p.short}</h2>
                        <p className="mt-2 text-[15px] leading-snug">
                          <span className="dp-display text-[19px] italic text-[var(--gold)]">{p.period}</span>
                          <span className="opacity-40"> · </span>
                          <span className="opacity-70">{p.tagline}</span>
                        </p>
                      </div>
                    </div>
                    {/* back detail */}
                    <div className="dp-flip-back">
                      <p className="dp-mono text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[var(--gold)]">{p.name} gồm</p>
                      <ul className="mt-5 grow space-y-3">
                        {p.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-2.5 text-[15px] font-light leading-[1.5] text-[var(--ink-muted)]">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--moss)]" strokeWidth={2.25} /> {b}
                          </li>
                        ))}
                      </ul>
                      <PayButton amount={p.price} description={p.desc} label={`Thanh toán · ${dong(p.price)}`} className="dp-btn dp-btn-solid dp-btn-lg w-full justify-center" />
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.1}>
            <p className="mt-8 text-center text-[14px] font-light text-[var(--ink-faint)]">Liên hệ để được tư vấn cụ thể.</p>
          </Reveal>
        </div>
      </section>

      {/* ── comparison table ── */}
      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 lg:py-24">
          <Reveal>
            <h2 className="dp-display text-[clamp(1.9rem,3.6vw,2.7rem)] font-bold leading-[1.1] tracking-[-0.015em]">So sánh <span className="italic text-[var(--gold)]">chi tiết.</span></h2>
            <p className="mt-4 text-[15px] font-light text-[var(--ink-muted)]">Quyền lợi cụ thể của từng gói. Cuộn ngang trên điện thoại.</p>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="mt-10 overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse">
                <thead>
                  <tr className="border-b-2 border-[var(--ink)]">
                    <th className="dp-mono w-[37%] py-4 pr-4 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Quyền lợi</th>
                    <th className="px-3 py-4 text-center">
                      <span className="dp-display block text-[18px] font-bold">ADN Base</span>
                      <span className="dp-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-faint)]">3 tháng</span>
                      <span className="dp-num mt-1 block text-[15px] font-bold">{dong(649000)}</span>
                    </th>
                    <th className="bg-[color-mix(in_srgb,var(--mint)_55%,transparent)] px-3 py-4 text-center">
                      <span className="dp-display block text-[18px] font-bold text-[var(--moss)]">ADN VIP</span>
                      <span className="dp-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--moss)]">Phổ biến · 6 tháng</span>
                      <span className="dp-num mt-1 block text-[15px] font-bold text-[var(--moss)]">{dong(1199000)}</span>
                    </th>
                    <th className="px-3 py-4 text-center">
                      <span className="dp-display block text-[18px] font-bold">ADN Premium</span>
                      <span className="dp-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-faint)]">12 tháng</span>
                      <span className="dp-num mt-1 block text-[15px] font-bold">{dong(1999000)}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((g) => (
                    <Fragment key={g.group}>
                      <tr>
                        <td colSpan={4} className="dp-mono pb-2 pt-7 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold)]">{g.group}</td>
                      </tr>
                      {g.rows.map((row) => (
                        <tr key={row.label} className="border-t border-[var(--hairline)]">
                          <td className="py-3.5 pr-4 text-[14.5px] font-light text-[var(--ink)]">{row.label}</td>
                          <CompareCell v={row.base} />
                          <CompareCell v={row.vip} featured />
                          <CompareCell v={row.premium} />
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── faq ── */}
      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[760px] px-5 py-20 sm:px-8 lg:py-24">
          <Reveal>
            <h2 className="dp-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-bold leading-[1.1] tracking-[-0.015em]">Câu hỏi <span className="italic text-[var(--gold)]">thường gặp.</span></h2>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="mt-10 border-t border-[var(--hairline)]">
              {FAQ.map((f, i) => (
                <details key={f.q} className="dp-faq border-b border-[var(--hairline)]" {...(i === 0 ? { open: true } : {})}>
                  <summary className="flex cursor-pointer items-center justify-between gap-5 py-5">
                    <span className="text-[17px] font-semibold tracking-tight">{f.q}</span>
                    <ChevronDown className="dp-faq-icon h-5 w-5 shrink-0 text-[var(--moss)]" strokeWidth={2} />
                  </summary>
                  <p className="max-w-[64ch] pb-5 text-[15.5px] font-light leading-[1.6] text-[var(--ink-muted)]">{f.a}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── cta ── */}
      <section>
        <div className="mx-auto max-w-[1180px] px-5 py-24 sm:px-8">
          <Reveal>
            <div className="dp-cta relative overflow-hidden rounded-[28px] px-8 py-20 text-center sm:px-16">
              <h2 className="dp-display mx-auto max-w-[20ch] text-[clamp(2rem,4.2vw,3.2rem)] font-bold leading-[1.06] tracking-[-0.02em] text-[var(--cream)]">
                Cứ thử <span className="italic text-[var(--gold)]">7 ngày VIP đã.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-[46ch] text-[17px] font-light leading-[1.55] text-white/75">Mở tài khoản miễn phí, dùng hết công cụ trong tuần đầu rồi quyết định có gắn bó hay không.</p>
              <a href="/design-preview/auth?mode=register" className="dp-btn dp-btn-on-dark dp-btn-lg mt-9">Mở tài khoản miễn phí <ArrowRight className="h-4 w-4" strokeWidth={1.75} /></a>
            </div>
          </Reveal>
        </div>
      </section>
    </Shell>
  );
}
