"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  Bell,
  Bot,
  ChevronRight,
  LineChart,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";

type ScreenKey = "onboarding" | "pulse" | "radar" | "stock" | "aiden";

type ScreenMeta = {
  key: ScreenKey;
  label: string;
  short: string;
  description: string;
};

const screens: ScreenMeta[] = [
  {
    key: "onboarding",
    label: "Bắt đầu",
    short: "Start",
    description: "Luồng mở app, định vị nhanh giá trị hệ sinh thái ADN.",
  },
  {
    key: "pulse",
    label: "ADN Pulse",
    short: "Pulse",
    description: "Tổng quan thị trường, ADNCore, bản tin sáng và EOD.",
  },
  {
    key: "radar",
    label: "ADN Radar",
    short: "Radar",
    description: "Bản đồ tín hiệu, entry, mục tiêu, cắt lỗ và lý do ngắn.",
  },
  {
    key: "stock",
    label: "ADN Stock",
    short: "Stock",
    description: "Chart cổ phiếu, tổng quan nhanh và nhận định AIDEN.",
  },
  {
    key: "aiden",
    label: "ADN AIDEN",
    short: "AIDEN",
    description: "Trợ lý hỏi đáp đầu tư theo phong cách chat tự nhiên.",
  },
];

const radarRows = [
  { ticker: "FPT", type: "Xu hướng", entry: "75.5", target: "82.0", stop: "72.0", score: "88" },
  { ticker: "SSI", type: "Dòng tiền", entry: "28.5", target: "31.2", stop: "27.1", score: "84" },
  { ticker: "GVR", type: "Tích lũy", entry: "32.8", target: "36.0", stop: "30.8", score: "81" },
];

const stockBars = [42, 56, 48, 72, 64, 82, 69, 88, 74, 61, 76, 94, 84, 97, 79, 90, 86, 101];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function MobilePrototypePage() {
  const [active, setActive] = useState<ScreenKey>("onboarding");
  const current = useMemo(() => screens.find((screen) => screen.key === active) ?? screens[0], [active]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#101216] text-[#f3efe7]">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute left-[-12rem] top-[-12rem] h-[28rem] w-[28rem] rounded-full bg-[#b8c7b5]/10 blur-3xl" />
        <div className="absolute right-[-10rem] top-[8rem] h-[26rem] w-[26rem] rounded-full bg-[#c9a95d]/10 blur-3xl" />
        <div className="absolute bottom-[-16rem] left-[30%] h-[30rem] w-[30rem] rounded-full bg-[#1f6f5b]/12 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_430px_minmax(0,0.9fr)] lg:items-center lg:gap-8 lg:px-8">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#b8c7b5]">
            <Sparkles className="h-3.5 w-3.5" />
            Mobile prototype
          </div>

          <div className="space-y-4">
            <h1 className="max-w-xl text-4xl font-bold leading-[0.98] tracking-[-0.03em] text-[#f8f5ef] sm:text-5xl lg:text-6xl">
              ADN Capital mobile app
            </h1>
            <p className="max-w-xl text-base leading-7 text-[#b9b2a8]">
              Prototype mobile-first để duyệt hướng rebuild app: một app đầu tư gọn, nhanh, ưu tiên Pulse,
              Radar, Stock và AIDEN.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            {screens.map((screen) => (
              <button
                key={screen.key}
                type="button"
                onClick={() => setActive(screen.key)}
                className={cn(
                  "group rounded-2xl border p-4 text-left transition duration-300",
                  active === screen.key
                    ? "border-[#b8c7b5]/45 bg-[#b8c7b5]/12 shadow-[0_20px_60px_-36px_rgba(184,199,181,0.8)]"
                    : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#f8f5ef]">{screen.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[#8e918b]">{screen.description}</p>
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 transition",
                      active === screen.key ? "translate-x-0 text-[#b8c7b5]" : "text-[#70746d] group-hover:translate-x-0.5",
                    )}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        <PhoneFrame active={active} setActive={setActive} />

        <aside className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_90px_-50px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8e918b]">Đang xem</p>
              <h2 className="mt-2 text-2xl font-bold text-[#f8f5ef]">{current.label}</h2>
              <p className="mt-2 text-sm leading-6 text-[#b9b2a8]">{current.description}</p>
            </div>
            <div className="rounded-2xl border border-[#b8c7b5]/25 bg-[#b8c7b5]/10 p-3 text-[#b8c7b5]">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <Note title="Scope an toàn" text="Route prototype riêng, không gọi API thị trường, không đụng cron, Telegram, DNSE hoặc DataHub." />
            <Note title="Hướng rebuild" text="Giữ PWA/Capacitor hiện tại, rebuild trải nghiệm mobile trước; chỉ nối data thật sau khi layout được duyệt." />
            <Note title="Nguyên tắc UX" text="Một màn hình một mục đích, thao tác ngắn, nội dung ưu tiên khả năng ra quyết định nhanh." />
          </div>
        </aside>
      </section>
    </main>
  );
}

function PhoneFrame({
  active,
  setActive,
}: {
  active: ScreenKey;
  setActive: (screen: ScreenKey) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[410px]">
      <div className="rounded-[42px] border border-white/15 bg-[#050608] p-3 shadow-[0_40px_120px_-50px_rgba(0,0,0,1)]">
        <div className="relative h-[800px] overflow-hidden rounded-[34px] border border-white/10 bg-[#111318]">
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-[#111318]/82 px-5 pb-3 pt-4 backdrop-blur-xl">
            <span className="text-xs font-bold text-[#f8f5ef]">09:41</span>
            <div className="absolute left-1/2 top-3 h-6 w-24 -translate-x-1/2 rounded-full bg-black/70" />
            <div className="flex items-center gap-1.5 text-[#b8c7b5]">
              <Bell className="h-3.5 w-3.5" />
              <span className="h-2 w-5 rounded-full border border-[#b8c7b5]/40" />
            </div>
          </div>

          <div className="h-full overflow-hidden pt-16">
            {active === "onboarding" && <OnboardingScreen setActive={setActive} />}
            {active === "pulse" && <PulseScreen />}
            {active === "radar" && <RadarScreen />}
            {active === "stock" && <StockScreen />}
            {active === "aiden" && <AidenScreen />}
          </div>

          <BottomNav active={active} setActive={setActive} />
        </div>
      </div>
    </div>
  );
}

function BottomNav({
  active,
  setActive,
}: {
  active: ScreenKey;
  setActive: (screen: ScreenKey) => void;
}) {
  const tabs = screens.filter((screen) => screen.key !== "onboarding");

  return (
    <div className="absolute inset-x-4 bottom-4 z-30 rounded-[28px] border border-white/10 bg-[#17191f]/92 p-2 shadow-[0_18px_52px_-30px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
      <div className="grid grid-cols-4 gap-1">
        {tabs.map((tab) => {
          const selected = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={cn(
                "rounded-2xl px-2 py-3 text-[11px] font-bold transition",
                selected ? "bg-[#b8c7b5] text-[#101216]" : "text-[#8e918b] hover:bg-white/[0.06] hover:text-[#f3efe7]",
              )}
            >
              {tab.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OnboardingScreen({ setActive }: { setActive: (screen: ScreenKey) => void }) {
  return (
    <div className="flex h-full flex-col px-5 pb-28 pt-8">
      <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#b8c7b5]/25 bg-[#b8c7b5]/10 text-[#b8c7b5]">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-[#b8c7b5]">ADN Capital</p>
        <h2 className="mt-3 text-4xl font-bold leading-tight tracking-[-0.04em] text-[#f8f5ef]">
          Một app cho toàn bộ hành trình đầu tư
        </h2>
        <p className="mt-4 text-sm leading-6 text-[#b9b2a8]">
          Từ tổng quan thị trường, tín hiệu, cổ phiếu đến trợ lý AIDEN trong một trải nghiệm mobile gọn hơn.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniFeature icon={<Activity className="h-4 w-4" />} label="Pulse" value="Thị trường" />
        <MiniFeature icon={<Target className="h-4 w-4" />} label="Radar" value="Tín hiệu" />
        <MiniFeature icon={<LineChart className="h-4 w-4" />} label="Stock" value="Cổ phiếu" />
        <MiniFeature icon={<Bot className="h-4 w-4" />} label="AIDEN" value="Trợ lý AI" />
      </div>

      <button
        type="button"
        onClick={() => setActive("pulse")}
        className="mt-auto rounded-2xl bg-[#b8c7b5] px-5 py-4 text-sm font-bold text-[#101216] shadow-[0_18px_45px_-24px_rgba(184,199,181,0.9)]"
      >
        Xem prototype
      </button>
    </div>
  );
}

function PulseScreen() {
  return (
    <ScreenShell title="ADN Pulse" subtitle="Tổng quan thị trường">
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="VN-INDEX" value="1,874.8" delta="+1.12%" positive />
        <MetricCard label="ADNCore" value="6.8/10" delta="Thăm dò" gold />
      </div>

      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8e918b]">30 phiên</p>
            <p className="mt-1 text-sm font-bold text-[#f8f5ef]">VN-INDEX</p>
          </div>
          <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-300">Realtime</span>
        </div>
        <MiniLineChart />
      </div>

      <div className="rounded-[24px] border border-[#c9a95d]/20 bg-[#c9a95d]/8 p-4">
        <div className="flex items-center gap-2 text-[#e6c875]">
          <Sparkles className="h-4 w-4" />
          <p className="text-xs font-bold uppercase tracking-[0.18em]">Nhận định AIDEN</p>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#f3efe7]">
          Thị trường hồi phục, nhưng ưu tiên nhóm có dòng tiền thật và nền giá tích lũy rõ.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SmallStat label="Tăng" value="213" />
        <SmallStat label="Giảm" value="97" />
        <SmallStat label="Đứng" value="57" />
      </div>
    </ScreenShell>
  );
}

function RadarScreen() {
  return (
    <ScreenShell title="ADN Radar" subtitle="Bản đồ tín hiệu">
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8e918b]">Tín hiệu mới</p>
            <p className="mt-1 text-2xl font-bold text-[#f8f5ef]">12 mã</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-300">
            <Target className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {radarRows.map((row) => (
          <div key={row.ticker} className="rounded-[24px] border border-white/10 bg-[#181b21] p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-black text-[#f8f5ef]">{row.ticker}</p>
                  <span className="rounded-full bg-[#b8c7b5]/12 px-2 py-0.5 text-[10px] font-bold text-[#b8c7b5]">{row.type}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#b9b2a8]">
                  Entry {row.entry} · Mục tiêu {row.target} · Cắt lỗ {row.stop}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#8e918b]">Điểm</p>
                <p className="text-lg font-black text-[#e6c875]">{row.score}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScreenShell>
  );
}

function StockScreen() {
  return (
    <ScreenShell title="ADN Stock" subtitle="Chart và nhận định">
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
        <Search className="h-4 w-4 text-[#8e918b]" />
        <span className="text-sm font-bold text-[#f8f5ef]">FPT</span>
        <span className="ml-auto rounded-full bg-emerald-400/10 px-2 py-1 text-[11px] font-bold text-emerald-300">+1.48%</span>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-[#f8f5ef]">FPT · Biểu đồ cổ phiếu</p>
          <div className="flex gap-1">
            {["1m", "5m", "1D"].map((item) => (
              <span key={item} className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-[#b9b2a8]">
                {item}
              </span>
            ))}
          </div>
        </div>
        <Candles />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Giá mục tiêu" value="82.0" delta="Theo vùng" gold />
        <MetricCard label="Cắt lỗ" value="72.0" delta="Quản trị" />
      </div>

      <div className="rounded-[24px] border border-[#b8c7b5]/20 bg-[#b8c7b5]/8 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b8c7b5]">AIDEN nhận định</p>
        <p className="mt-3 text-sm leading-6 text-[#f3efe7]">
          FPT giữ nền tích lũy tốt, giá còn trên MA20. Chỉ tăng tỷ trọng khi thanh khoản xác nhận.
        </p>
      </div>
    </ScreenShell>
  );
}

function AidenScreen() {
  return (
    <ScreenShell title="ADN AIDEN" subtitle="Trợ lý đầu tư">
      <div className="space-y-3">
        <ChatBubble side="bot" text="Anh/chị muốn tìm cổ phiếu theo dòng tiền, định giá hay tín hiệu kỹ thuật?" />
        <ChatBubble side="user" text="Top mã đáng chú ý hôm nay" />
        <ChatBubble
          side="bot"
          text="Ưu tiên nhóm có RS cao, thanh khoản cải thiện và chưa tăng nóng. Có thể xem nhanh FPT, SSI, GVR; cần kiểm tra điểm mua trước khi giải ngân."
        />
      </div>

      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8e918b]">Gợi ý nhanh</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Nhận xét thị trường", "So sánh FPT SSI", "Lọc dòng tiền mạnh"].map((item) => (
            <button
              key={item}
              type="button"
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[#f3efe7]"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-[#191b21] p-2">
        <span className="flex-1 px-3 text-sm text-[#8e918b]">Hỏi AIDEN...</span>
        <button type="button" className="rounded-xl bg-[#b8c7b5] p-3 text-[#101216]">
          <Bot className="h-4 w-4" />
        </button>
      </div>
    </ScreenShell>
  );
}

function ScreenShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-5 pb-28 pt-5">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8e918b]">ADN Capital</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#f8f5ef]">{title}</h2>
          <p className="mt-1 text-sm text-[#b9b2a8]">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[#b8c7b5]">
          <Zap className="h-5 w-5" />
        </div>
      </header>
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  delta,
  positive,
  gold,
}: {
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
  gold?: boolean;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8e918b]">{label}</p>
      <p className="mt-3 text-2xl font-black text-[#f8f5ef]">{value}</p>
      <p className={cn("mt-1 text-xs font-bold", positive ? "text-emerald-300" : gold ? "text-[#e6c875]" : "text-[#b9b2a8]")}>{delta}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-center">
      <p className="text-xs text-[#8e918b]">{label}</p>
      <p className="mt-1 text-lg font-black text-[#f8f5ef]">{value}</p>
    </div>
  );
}

function MiniFeature({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[#b8c7b5]">{icon}</div>
      <p className="mt-3 text-sm font-bold text-[#f8f5ef]">{label}</p>
      <p className="mt-1 text-xs text-[#8e918b]">{value}</p>
    </div>
  );
}

function MiniLineChart() {
  const points = [18, 22, 20, 26, 29, 31, 27, 35, 38, 34, 42, 46, 44, 52, 57, 54, 61, 67];
  const width = 280;
  const height = 120;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const d = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point - min) / (max - min)) * (height - 18) - 8;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-32 w-full overflow-visible">
      <defs>
        <linearGradient id="pulseLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b8c7b5" />
          <stop offset="100%" stopColor="#e6c875" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((line) => (
        <line key={line} x1="0" x2={width} y1={24 + line * 25} y2={24 + line * 25} stroke="rgba(255,255,255,0.06)" />
      ))}
      <path d={d} fill="none" stroke="url(#pulseLine)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy="42" r="5" fill="#e6c875" />
    </svg>
  );
}

function Candles() {
  return (
    <div className="mt-5 flex h-48 items-end gap-1.5 rounded-2xl border border-white/10 bg-[#101216]/65 p-4">
      {stockBars.map((height, index) => {
        const up = index % 4 !== 0;
        return (
          <div key={`${height}-${index}`} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="w-px rounded-full bg-white/20" style={{ height: `${Math.max(18, height - 34)}px` }} />
            <span
              className={cn("w-full rounded-sm", up ? "bg-[#b8c7b5]" : "bg-[#d65b4a]")}
              style={{ height: `${Math.max(18, Math.round(height * 0.42))}px` }}
            />
          </div>
        );
      })}
    </div>
  );
}

function ChatBubble({ side, text }: { side: "bot" | "user"; text: string }) {
  const isUser = side === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[84%] rounded-[22px] px-4 py-3 text-sm leading-6",
          isUser
            ? "bg-[#b8c7b5] text-[#101216]"
            : "border border-white/10 bg-white/[0.045] text-[#f3efe7]",
        )}
      >
        {text}
      </div>
    </div>
  );
}

function Note({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-sm font-bold text-[#f8f5ef]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#b9b2a8]">{text}</p>
    </div>
  );
}
