"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Bot,
  CandlestickChart,
  MousePointer2,
  Radio,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { BRAND, PRODUCT_NAMES } from "@/lib/brand/productNames";

type ProductId = "pulse" | "radar" | "stock" | "aiden";

type ShowcaseProduct = {
  id: ProductId;
  name: string;
  subtitle: string;
  dbName: string;
  icon: LucideIcon;
};

type PointerStep = {
  x: string;
  y: string;
  hotspot?: string;
  click?: boolean;
  advanceTo?: ProductId;
  duration?: number;
};

const TOUR_MS = 5200;

const products: ShowcaseProduct[] = [
  {
    id: "pulse",
    name: PRODUCT_NAMES.market,
    subtitle: "Tổng quan thị trường",
    dbName: "MARKET.DB",
    icon: Activity,
  },
  {
    id: "radar",
    name: PRODUCT_NAMES.signalMap,
    subtitle: "Bản đồ tín hiệu",
    dbName: "SIGNALS.DB",
    icon: Radio,
  },
  {
    id: "stock",
    name: PRODUCT_NAMES.stock,
    subtitle: "Tra cứu cổ phiếu",
    dbName: "STOCK.DB",
    icon: CandlestickChart,
  },
  {
    id: "aiden",
    name: PRODUCT_NAMES.advisory,
    subtitle: "Trợ lý đầu tư",
    dbName: "AIDEN.DB",
    icon: Bot,
  },
];

const navPoints: Record<ProductId, { x: string; y: string }> = {
  pulse: { x: "13.5%", y: "45%" },
  radar: { x: "13.5%", y: "54%" },
  stock: { x: "13.5%", y: "63%" },
  aiden: { x: "13.5%", y: "72%" },
};

function nextProductId(productId: ProductId) {
  const index = products.findIndex((product) => product.id === productId);
  return products[(index + 1) % products.length].id;
}

function stepsFor(productId: ProductId): PointerStep[] {
  const nextId = nextProductId(productId);
  const productNav = navPoints[productId];
  const nextNav = navPoints[nextId];

  const contentSteps: Record<ProductId, PointerStep[]> = {
    pulse: [
      { x: "53%", y: "39%", hotspot: "pulse-chart", duration: 900 },
      { x: "53%", y: "39%", hotspot: "pulse-chart", click: true, duration: 560 },
      { x: "70%", y: "72%", hotspot: "pulse-brief", duration: 900 },
    ],
    radar: [
      { x: "58%", y: "42%", hotspot: "radar-list", duration: 900 },
      { x: "58%", y: "42%", hotspot: "radar-list", click: true, duration: 560 },
      { x: "71%", y: "70%", hotspot: "radar-reason", duration: 900 },
    ],
    stock: [
      { x: "56%", y: "44%", hotspot: "stock-chart", duration: 900 },
      { x: "56%", y: "44%", hotspot: "stock-chart", click: true, duration: 560 },
      { x: "74%", y: "70%", hotspot: "stock-aiden", duration: 900 },
    ],
    aiden: [
      { x: "63%", y: "42%", hotspot: "aiden-chat", duration: 900 },
      { x: "63%", y: "42%", hotspot: "aiden-chat", click: true, duration: 560 },
      { x: "69%", y: "78%", hotspot: "aiden-input", duration: 900 },
    ],
  };

  return [
    { ...productNav, hotspot: `nav-${productId}`, duration: 520 },
    { ...productNav, hotspot: `nav-${productId}`, click: true, duration: 460 },
    ...contentSteps[productId],
    { ...nextNav, hotspot: `nav-${nextId}`, duration: 820 },
    { ...nextNav, hotspot: `nav-${nextId}`, click: true, advanceTo: nextId, duration: 520 },
  ];
}

function themedPanel(active = false): CSSProperties {
  return {
    background: "color-mix(in srgb, var(--bg-surface) 78%, transparent)",
    borderColor: active ? "var(--primary)" : "color-mix(in srgb, var(--border) 82%, transparent)",
    boxShadow: active ? "0 0 0 1px var(--primary), 0 18px 48px -34px var(--primary)" : "0 18px 54px -48px rgba(13,20,16,0.34)",
    backdropFilter: "blur(18px)",
  };
}

export function AdnHeroProductShowcase() {
  const reduceMotion = useReducedMotion();
  const [activeId, setActiveId] = useState<ProductId>("pulse");
  const [stepIndex, setStepIndex] = useState(0);
  const [isClicking, setIsClicking] = useState(false);
  const showcaseRef = useRef<HTMLDivElement | null>(null);
  const [pointerPx, setPointerPx] = useState<{ left: number; top: number } | null>(null);

  const activeProduct = useMemo(() => products.find((product) => product.id === activeId) ?? products[0], [activeId]);
  const activeSteps = useMemo(() => stepsFor(activeProduct.id), [activeProduct.id]);
  const currentStep = activeSteps[stepIndex] ?? activeSteps[0];

  const selectProduct = (productId: ProductId) => {
    setActiveId(productId);
    setStepIndex(0);
  };

  useEffect(() => {
    setStepIndex(0);
  }, [activeId]);

  useEffect(() => {
    if (reduceMotion) return;

    const timer = window.setTimeout(() => {
      if (currentStep.advanceTo) {
        setActiveId(currentStep.advanceTo);
        return;
      }

      setStepIndex((index) => Math.min(index + 1, activeSteps.length - 1));
    }, currentStep.duration ?? 800);

    return () => window.clearTimeout(timer);
  }, [activeSteps.length, currentStep, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || !currentStep.click) {
      setIsClicking(false);
      return;
    }

    const down = window.setTimeout(() => setIsClicking(true), 90);
    const up = window.setTimeout(() => setIsClicking(false), 320);
    return () => {
      window.clearTimeout(down);
      window.clearTimeout(up);
    };
  }, [currentStep, reduceMotion]);

  useLayoutEffect(() => {
    const root = showcaseRef.current;
    if (!root) return;

    const updatePointer = () => {
      const rootRect = root.getBoundingClientRect();
      const target = currentStep.hotspot
        ? root.querySelector<HTMLElement>(`[data-demo-target="${currentStep.hotspot}"]`)
        : null;

      if (target) {
        const targetRect = target.getBoundingClientRect();
        setPointerPx({
          left: targetRect.left - rootRect.left + targetRect.width * 0.52 - 18,
          top: targetRect.top - rootRect.top + targetRect.height * 0.5 - 18,
        });
        return;
      }

      setPointerPx(null);
    };

    updatePointer();
    window.addEventListener("resize", updatePointer);
    const id = window.setTimeout(updatePointer, 80);
    return () => {
      window.removeEventListener("resize", updatePointer);
      window.clearTimeout(id);
    };
  }, [activeId, currentStep.hotspot, stepIndex]);

  return (
    <section aria-label={`${BRAND.company} auto product showcase`} className="w-full min-w-0">
      <div
        className="relative overflow-hidden rounded-[1.65rem] border p-4 shadow-[0_34px_90px_-58px_rgba(13,20,16,0.55)] sm:p-6"
        style={{
          background:
            "radial-gradient(circle at 84% 0%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 38%), radial-gradient(circle at 10% 92%, color-mix(in srgb, var(--secondary) 10%, transparent), transparent 34%), color-mix(in srgb, var(--page-surface) 92%, var(--bg-surface) 8%)",
          borderColor: "color-mix(in srgb, var(--border) 82%, transparent)",
        }}
      >
        <div
          ref={showcaseRef}
          className="relative mx-auto aspect-[1.16/1] min-h-[420px] w-full overflow-hidden rounded-[0.9rem] border sm:min-h-[520px]"
          style={{
            background:
              "linear-gradient(145deg, color-mix(in srgb, var(--bg-surface) 82%, transparent), color-mix(in srgb, var(--surface-2) 76%, transparent))",
            borderColor: "color-mix(in srgb, var(--border) 86%, transparent)",
            boxShadow: "0 34px 90px -64px rgba(13,20,16,0.72)",
            backdropFilter: "blur(22px)",
          }}
        >
          <TerminalTopBar product={activeProduct} />

          <div className="grid h-[calc(100%-54px)] grid-cols-[34%_66%] sm:grid-cols-[28%_72%]">
            <aside
              className="border-r px-4 py-5 sm:px-5"
              style={{
                borderColor: "color-mix(in srgb, var(--border) 84%, transparent)",
                background: "color-mix(in srgb, var(--bg-surface) 70%, transparent)",
                backdropFilter: "blur(18px)",
              }}
            >
              <SidebarIdentity />

              <div className="mt-6">
                <p className="mb-3 font-mono text-[0.65rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Sản phẩm
                </p>
                <nav className="space-y-2" aria-label="Mock product tabs">
                  {products.map((product) => (
                    <ProductTab
                      key={product.id}
                      product={product}
                      active={product.id === activeProduct.id}
                      pointed={currentStep.hotspot === `nav-${product.id}`}
                      onClick={() => selectProduct(product.id)}
                    />
                  ))}
                </nav>
              </div>

              <div className="mt-8 hidden space-y-3 text-sm font-bold text-[var(--text-muted)] sm:block">
                <div className="flex items-center justify-between">
                  <span>Trạng thái</span>
                  <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                </div>
                <div className="flex items-center justify-between">
                  <span>Realtime</span>
                  <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                </div>
              </div>
            </aside>

            <main className="relative min-w-0 overflow-hidden p-5 sm:p-7">
              <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 70% 10%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 28%), linear-gradient(135deg, color-mix(in srgb, var(--bg-surface) 74%, transparent), color-mix(in srgb, var(--surface-2) 68%, transparent))",
                }}
              />
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeProduct.id}
                  className="absolute inset-0 p-5 sm:p-7"
                  initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 18, filter: "blur(6px)" }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -18, filter: "blur(6px)" }}
                  transition={{ duration: reduceMotion ? 0 : 0.34, ease: "easeOut" }}
                >
                  <ProductContent product={activeProduct} hotspot={currentStep.hotspot} />
                </motion.div>
              </AnimatePresence>
            </main>
          </div>

          <div
            className="absolute bottom-0 left-0 right-0 flex h-11 items-center justify-center gap-2 border-t"
            style={{
              borderColor: "color-mix(in srgb, var(--border) 62%, var(--text-primary) 38%)",
              background: "color-mix(in srgb, var(--bg-surface) 74%, transparent)",
              backdropFilter: "blur(16px)",
            }}
          >
            {products.map((product) => (
              <span
                key={product.id}
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: product.id === activeProduct.id ? 28 : 9,
                  background:
                    product.id === activeProduct.id
                      ? "var(--primary)"
                      : "color-mix(in srgb, var(--text-muted) 62%, transparent)",
                }}
              />
            ))}
          </div>

          {!reduceMotion ? (
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute z-50 hidden h-9 w-9 items-center justify-center rounded-full lg:flex"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-strong)",
                color: "var(--primary)",
                boxShadow: "0 16px 34px rgba(0,0,0,0.34)",
              }}
                initial={{ left: pointerPx?.left ?? currentStep.x, top: pointerPx?.top ?? currentStep.y, opacity: 0 }}
                animate={{
                  left: pointerPx?.left ?? currentStep.x,
                  top: pointerPx?.top ?? currentStep.y,
                  opacity: 1,
                  scale: isClicking ? 0.82 : 1,
                }}
              transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
            >
              <MousePointer2 className="h-4 w-4" />
              <motion.span
                className="absolute inset-0 rounded-full"
                style={{ border: "1px solid var(--primary)" }}
                animate={{
                  scale: isClicking ? [0.72, 1.75] : [0.85, 1.35],
                  opacity: isClicking ? [0.7, 0] : [0.18, 0],
                }}
                transition={{ duration: isClicking ? 0.34 : 1.1, repeat: isClicking ? 0 : Infinity, ease: "easeOut" }}
              />
            </motion.div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function TerminalTopBar({ product }: { product: ShowcaseProduct }) {
  return (
    <div
      className="grid h-[54px] grid-cols-[1fr_auto_1fr] items-center border-b px-5"
      style={{
        borderColor: "color-mix(in srgb, var(--border) 84%, transparent)",
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 88%, transparent), color-mix(in srgb, var(--surface-2) 72%, transparent))",
        backdropFilter: "blur(18px)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-muted)] opacity-65" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-muted)] opacity-65" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-muted)] opacity-65" />
      </div>
      <p className="font-mono text-[0.72rem] font-black uppercase tracking-[0.28em] text-[var(--text-secondary)] sm:text-xs">
        ADN CAPITAL / {product.dbName}
      </p>
      <p className="justify-self-end font-mono text-[0.72rem] font-black tracking-[0.18em] text-[var(--text-secondary)] sm:text-xs">
        v2.4.1
      </p>
    </div>
  );
}

function SidebarIdentity() {
  return (
    <div>
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border"
          style={{
            background: "color-mix(in srgb, var(--primary) 14%, var(--bg-surface))",
            borderColor: "color-mix(in srgb, var(--primary) 42%, var(--border))",
            color: "var(--primary)",
          }}
        >
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-black text-[var(--text-primary)]">{BRAND.company}</p>
          <p className="font-mono text-[0.7rem] font-bold text-[var(--text-muted)]">v2.3.44</p>
        </div>
      </div>
      <div className="mt-5 h-px bg-[var(--border)] opacity-70" />
      <div className="mt-4 flex items-center gap-2 text-sm font-black text-[var(--primary)]">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
        Đang chạy
      </div>
    </div>
  );
}

function ProductTab({
  product,
  active,
  pointed,
  onClick,
}: {
  product: ShowcaseProduct;
  active: boolean;
  pointed: boolean;
  onClick: () => void;
}) {
  const Icon = product.icon;

  return (
    <button
      type="button"
      data-demo-target={`nav-${product.id}`}
      className="relative flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition-all"
      style={{
        background: active
          ? "color-mix(in srgb, var(--primary) 12%, var(--bg-surface))"
          : "transparent",
        borderColor: pointed
          ? "var(--primary)"
          : active
            ? "color-mix(in srgb, var(--primary) 38%, var(--border))"
            : "transparent",
        color: active ? "var(--primary)" : "var(--text-secondary)",
        boxShadow: pointed ? "0 0 0 1px var(--primary), 0 14px 34px -28px var(--primary)" : undefined,
      }}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="truncate text-sm font-black">{product.name}</p>
        <p className="hidden truncate text-[0.68rem] font-bold text-[var(--text-muted)] sm:block">{product.subtitle}</p>
      </div>
    </button>
  );
}

function ProductContent({ product, hotspot }: { product: ShowcaseProduct; hotspot?: string }) {
  if (product.id === "radar") return <RadarContent hotspot={hotspot} />;
  if (product.id === "stock") return <StockContent hotspot={hotspot} />;
  if (product.id === "aiden") return <AidenContent hotspot={hotspot} />;
  return <PulseContent hotspot={hotspot} />;
}

function ScreenTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: "color-mix(in srgb, var(--primary) 20%, var(--bg-surface))",
          color: "var(--primary)",
        }}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <h2 className="truncate font-serif text-[clamp(1.75rem,4vw,2.55rem)] font-black tracking-[-0.035em] text-[var(--text-primary)]">
          {title}
        </h2>
        <p className="truncate text-sm font-bold text-[var(--text-muted)]">{subtitle}</p>
      </div>
    </div>
  );
}

function PulseContent({ hotspot }: { hotspot?: string }) {
  return (
    <div className="flex h-full flex-col pb-10">
      <ScreenTitle icon={Activity} title={PRODUCT_NAMES.market} subtitle="VNINDEX, ADNCore và bản tin thị trường" />

      <div className="mt-7 grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <DemoCard active={hotspot === "pulse-chart"} demoTarget="pulse-chart">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-black text-[var(--text-primary)]">VNINDEX 30 phiên</p>
              <p className="text-sm font-bold text-[var(--text-muted)]">Thanh khoản · độ rộng · xu hướng</p>
            </div>
            <Pill>+0,42%</Pill>
          </div>
          <PulseChart />
        </DemoCard>

        <div className="grid gap-4">
          <DemoCard active={hotspot === "pulse-chart"}>
            <p className="font-mono text-xs font-black uppercase text-[var(--text-muted)]">ADNCore</p>
            <div className="mt-4 flex items-center justify-center">
              <div className="relative h-28 w-48">
                <div
                  className="absolute inset-x-0 top-0 h-24 rounded-t-full"
                  style={{
                    background:
                      "conic-gradient(from 240deg, var(--danger), var(--secondary), var(--primary), transparent 142deg)",
                  }}
                />
                <div className="absolute inset-x-5 top-5 h-20 rounded-t-full" style={{ background: "var(--bg-surface)" }} />
                <div className="absolute bottom-3 left-1/2 h-14 w-1 origin-bottom -translate-x-1/2 rotate-[18deg] rounded-full bg-[var(--secondary)]" />
                <p className="absolute bottom-0 left-0 right-0 text-center text-3xl font-black text-[var(--secondary)]">
                  8 <span className="text-sm text-[var(--text-muted)]">/14</span>
                </p>
              </div>
            </div>
          </DemoCard>

          <DemoCard active={hotspot === "pulse-brief"} demoTarget="pulse-brief">
            <ListRow title="Bản tin sáng" meta="Dòng tiền tập trung nhóm dẫn dắt" />
            <ListRow title="Bản tin tổng hợp" meta="Thị trường thăm dò, tránh mua đuổi" />
          </DemoCard>
        </div>
      </div>
    </div>
  );
}

function RadarContent({ hotspot }: { hotspot?: string }) {
  const rows = [
    ["GVR", "32.5 - 33.5", "36.5", "30.8"],
    ["HPG", "27.2 - 27.8", "31.2", "25.9"],
    ["FPT", "74.0 - 76.0", "84.0", "71.6"],
  ];

  return (
    <div className="flex h-full flex-col pb-10">
      <ScreenTitle icon={Radio} title={PRODUCT_NAMES.signalMap} subtitle="Điểm vào, chốt lời, cắt lỗ và lý do mua" />

      <div className="mt-7 grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.18fr_0.82fr]">
        <DemoCard active={hotspot === "radar-list"} demoTarget="radar-list">
          <div className="space-y-3">
            {rows.map(([ticker, entry, target, stop]) => (
              <div key={ticker} className="rounded-lg border p-3" style={themedPanel(false)}>
                <div className="grid grid-cols-[54px_1fr_1fr_1fr] items-center gap-3 text-sm">
                  <b className="text-lg text-[var(--text-primary)]">{ticker}</b>
                  <Signal label="Entry" value={entry} />
                  <Signal label="Take profit" value={target} />
                  <Signal label="Stoploss" value={stop} />
                </div>
              </div>
            ))}
          </div>
        </DemoCard>

        <DemoCard active={hotspot === "radar-reason"} demoTarget="radar-reason">
          <p className="font-mono text-xs font-black uppercase text-[var(--text-muted)]">AI báo lý do mua</p>
          <p className="mt-4 text-lg font-black text-[var(--text-primary)]">GVR · tín hiệu đang mở</p>
          <p className="mt-3 text-sm font-semibold leading-7 text-[var(--text-secondary)]">
            Giá giữ nền tích lũy, lực bán giảm dần và vùng cắt lỗ đủ gần để kiểm soát rủi ro. Ưu tiên giải ngân từng phần khi giá giữ trên vùng hỗ trợ.
          </p>
          <div className="mt-5 rounded-md border-l-4 border-[var(--primary)] px-4 py-3" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}>
            <p className="text-sm font-black text-[var(--text-primary)]">Đặt lệnh GVR</p>
          </div>
        </DemoCard>
      </div>
    </div>
  );
}

function StockContent({ hotspot }: { hotspot?: string }) {
  return (
    <div className="flex h-full flex-col pb-10">
      <ScreenTitle icon={CandlestickChart} title={PRODUCT_NAMES.stock} subtitle="Chart cổ phiếu và nhận định ngắn từ AIDEN" />

      <div className="mt-7 grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <DemoCard active={hotspot === "stock-chart"} demoTarget="stock-chart">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-black text-[var(--text-primary)]">HPG · Biểu đồ cổ phiếu</p>
              <p className="text-sm font-bold text-[var(--text-muted)]">Giá · khối lượng · đường trung bình</p>
            </div>
            <div className="flex gap-1">
              {["1m", "5m", "15m", "1D"].map((item) => (
                <span key={item} className="rounded border px-2 py-1 font-mono text-[0.65rem] font-black" style={{ borderColor: "var(--border)" }}>
                  {item}
                </span>
              ))}
            </div>
          </div>
          <CandleChart />
        </DemoCard>

        <DemoCard active={hotspot === "stock-aiden"} demoTarget="stock-aiden">
          <p className="font-mono text-xs font-black uppercase text-[var(--text-muted)]">AIDEN nhận định</p>
          <p className="mt-4 text-sm font-semibold leading-7 text-[var(--text-secondary)]">
            HPG đang giữ vùng nền sau nhịp hồi. Giá nằm gần MA20, khối lượng cải thiện nhưng chưa nên mua đuổi. Vùng theo dõi: 27.2 - 27.8.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <MiniStat label="Mục tiêu" value="31.2" />
            <MiniStat label="Cắt lỗ" value="25.9" />
            <MiniStat label="P/E" value="11,6x" />
            <MiniStat label="P/B" value="1,4x" />
          </div>
        </DemoCard>
      </div>
    </div>
  );
}

function AidenContent({ hotspot }: { hotspot?: string }) {
  return (
    <div className="flex h-full flex-col pb-10">
      <ScreenTitle icon={Bot} title={PRODUCT_NAMES.advisory} subtitle="Khung chat cổ phiếu, trả lời tóm tắt và dễ đọc" />

      <DemoCard
        active={hotspot === "aiden-chat" || hotspot === "aiden-input"}
        className="mt-7 min-h-0 flex-1"
        demoTarget="aiden-chat"
      >
        <div className="flex h-full flex-col">
          <div className="space-y-3">
            <ChatBubble side="user">Top 5 mã đáng chú ý hôm nay?</ChatBubble>
            <ChatBubble side="bot">
              Ưu tiên nhóm giữ nền giá tốt, thanh khoản tăng dần và chưa vượt xa hỗ trợ. Danh sách theo dõi nhanh: FPT, HPG, SSI, GVR và MBB.
            </ChatBubble>
            <ChatBubble side="user">Phân tích nhanh FPT</ChatBubble>
            <ChatBubble side="bot">
              FPT vẫn là cổ phiếu khỏe trong nhóm công nghệ. Theo dõi vùng hỗ trợ gần, tránh mua đuổi khi động lượng chưa xác nhận rõ.
            </ChatBubble>
          </div>
          <div
            className="mt-auto flex items-center gap-3 rounded-lg border px-4 py-3"
            data-demo-target="aiden-input"
            style={{
              ...themedPanel(hotspot === "aiden-input"),
              background: "color-mix(in srgb, var(--bg-surface) 82%, var(--text-primary) 18%)",
            }}
          >
            <span className="flex-1 text-sm font-bold text-[var(--text-muted)]">Hỏi AIDEN về cổ phiếu...</span>
            <span className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-black text-[var(--on-primary)]">Gửi</span>
          </div>
        </div>
      </DemoCard>
    </div>
  );
}

function DemoCard({
  children,
  active,
  className = "",
  demoTarget,
}: {
  children: ReactNode;
  active?: boolean;
  className?: string;
  demoTarget?: string;
}) {
  return (
    <div
      className={`rounded-lg border p-4 transition-all duration-300 ${className}`}
      data-demo-target={demoTarget}
      style={themedPanel(Boolean(active))}
    >
      {children}
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-[var(--primary)] px-3 py-1 text-xs font-black text-[var(--on-primary)]">
      {children}
    </span>
  );
}

function ListRow({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="rounded-lg border px-4 py-3" style={themedPanel(false)}>
      <p className="font-black text-[var(--text-primary)]">{title}</p>
      <p className="text-sm font-bold text-[var(--text-muted)]">{meta}</p>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[0.62rem] font-black uppercase text-[var(--text-muted)]">{label}</p>
      <p className="font-black text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2.5" style={themedPanel(false)}>
      <p className="font-mono text-[0.62rem] font-black uppercase text-[var(--text-muted)]">{label}</p>
      <p className="text-sm font-black text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function ChatBubble({ children, side }: { children: ReactNode; side: "user" | "bot" }) {
  const isUser = side === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[82%] rounded-lg border px-4 py-3 text-sm font-semibold leading-6"
        style={{
          background: isUser ? "var(--primary)" : "color-mix(in srgb, var(--bg-surface) 86%, var(--text-primary) 14%)",
          borderColor: isUser ? "var(--primary)" : "var(--border)",
          color: isUser ? "var(--on-primary)" : "var(--text-primary)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function PulseChart() {
  const bars = [44, 52, 48, 61, 58, 66, 72, 69, 77, 82, 78, 88, 84, 92, 98, 93, 101, 108, 104, 112, 118, 114, 121, 126, 122, 130, 136, 132, 140, 146];

  return (
    <div className="relative mt-4 h-[205px] overflow-hidden rounded-lg border" style={themedPanel(false)}>
      <Grid />
      <svg viewBox="0 0 560 198" className="relative z-10 h-full w-full" role="img" aria-label="VNINDEX 30 phiên">
        <path
          d="M10 150 C46 132 72 146 104 118 C142 84 168 104 205 78 C244 52 276 74 314 58 C350 40 384 64 424 42 C470 18 504 36 550 20"
          fill="none"
          stroke="var(--primary)"
          strokeLinecap="round"
          strokeWidth="6"
        />
      </svg>
      <div className="absolute bottom-3 left-4 right-4 z-20 flex h-16 items-end gap-1">
        {bars.map((height, index) => (
          <span
            key={`${height}-${index}`}
            className="flex-1 rounded-t-sm"
            style={{
              height: `${Math.max(16, height * 0.46)}%`,
              background: index % 6 === 0 ? "var(--secondary)" : "color-mix(in srgb, var(--primary) 46%, transparent)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function CandleChart() {
  const candles = [58, 74, 68, 86, 76, 91, 72, 64, 82, 78, 88, 70, 62, 73, 84, 92, 87, 96, 88, 79, 91, 101, 94, 106];

  return (
    <div className="relative mt-4 h-[255px] overflow-hidden rounded-lg border px-4 py-4" style={themedPanel(false)}>
      <Grid />
      <div className="relative z-10 flex h-full items-end gap-2">
        {candles.map((height, index) => {
          const up = index % 5 !== 0 && index % 7 !== 0;
          return (
            <div key={`${height}-${index}`} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span
                className="w-px rounded-full"
                style={{ height: `${height + 15}px`, background: up ? "var(--primary)" : "var(--danger)", opacity: 0.72 }}
              />
              <span
                className="w-full max-w-[12px] rounded-sm"
                style={{ height: `${Math.max(18, height * 0.5)}px`, background: up ? "var(--primary)" : "var(--danger)" }}
              />
              <span className="mt-2 w-full max-w-[12px] rounded-sm bg-[var(--secondary)] opacity-45" style={{ height: `${Math.max(9, 42 - height * 0.2)}px` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Grid() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 opacity-45"
      style={{
        backgroundImage:
          "linear-gradient(color-mix(in srgb, var(--border) 64%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--border) 64%, transparent) 1px, transparent 1px)",
        backgroundSize: "46px 40px",
      }}
    />
  );
}
