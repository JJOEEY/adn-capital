"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Bot,
  MousePointer2,
  Radio,
  ShieldCheck,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { BRAND, PRODUCT_NAMES } from "@/lib/brand/productNames";

const TOUR_INTERVAL_MS = 3600;

type PointerPoint = {
  x: string;
  y: string;
};

type HeroProduct = {
  id: string;
  name: string;
  shortName: string;
  eyebrow: string;
  description: string;
  image: string;
  icon: LucideIcon;
  pointerPath: PointerPoint[];
};

const showcaseProducts: HeroProduct[] = [
  {
    id: "pulse",
    name: PRODUCT_NAMES.market,
    shortName: "Pulse",
    eyebrow: "Market dashboard",
    description: "Đọc VNINDEX, độ rộng, thanh khoản và trạng thái thị trường trong một màn hình.",
    image: "/hero-showcase/app-adn-pulse-main.png",
    icon: Activity,
    pointerPath: [
      { x: "26%", y: "34%" },
      { x: "58%", y: "31%" },
      { x: "72%", y: "54%" },
      { x: "34%", y: "68%" },
    ],
  },
  {
    id: "pilot",
    name: PRODUCT_NAMES.aiBroker,
    shortName: "Pilot",
    eyebrow: "Signal workflow",
    description: "Theo dõi cơ hội, trạng thái và hành động đề xuất trong lớp kiểm soát của ADN.",
    image: "/hero-showcase/app-adn-pilot.png",
    icon: Radio,
    pointerPath: [
      { x: "31%", y: "42%" },
      { x: "62%", y: "46%" },
      { x: "76%", y: "72%" },
      { x: "42%", y: "80%" },
    ],
  },
  {
    id: "art",
    name: PRODUCT_NAMES.art,
    shortName: "ART",
    eyebrow: "Action - Risk - Trend",
    description: "Kiểm tra trạng thái xu hướng, rủi ro và vùng hành động trước khi quyết định.",
    image: "/hero-showcase/app-adn-art.png",
    icon: ShieldCheck,
    pointerPath: [
      { x: "23%", y: "45%" },
      { x: "49%", y: "42%" },
      { x: "70%", y: "58%" },
      { x: "54%", y: "77%" },
    ],
  },
  {
    id: "aiden",
    name: BRAND.aiPersona,
    shortName: "AIDEN",
    eyebrow: PRODUCT_NAMES.advisoryShort,
    description: "Chat phân tích, tóm tắt bối cảnh và hỗ trợ đọc mã ngay trong terminal đầu tư.",
    image: "/hero-showcase/app-aiden.png",
    icon: Bot,
    pointerPath: [
      { x: "28%", y: "30%" },
      { x: "64%", y: "33%" },
      { x: "76%", y: "64%" },
      { x: "36%", y: "78%" },
    ],
  },
];

export function AdnHeroProductShowcase() {
  const reduceMotion = useReducedMotion();
  const [activeId, setActiveId] = useState(showcaseProducts[0].id);
  const [isPaused, setIsPaused] = useState(false);

  const activeIndex = useMemo(
    () => Math.max(0, showcaseProducts.findIndex((product) => product.id === activeId)),
    [activeId],
  );
  const activeProduct = showcaseProducts[activeIndex] ?? showcaseProducts[0];
  const progressKey = `${activeProduct.id}-${isPaused ? "paused" : "running"}`;

  useEffect(() => {
    if (reduceMotion || isPaused) return;

    const timer = window.setInterval(() => {
      setActiveId((currentId) => {
        const currentIndex = showcaseProducts.findIndex((product) => product.id === currentId);
        return showcaseProducts[(currentIndex + 1) % showcaseProducts.length].id;
      });
    }, TOUR_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [isPaused, reduceMotion]);

  return (
    <section
      aria-label={`${BRAND.company} product showcase`}
      className="w-full min-w-0"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
    >
      <div
        className="overflow-hidden rounded-[1.75rem] border p-2 shadow-[0_28px_70px_-36px_rgba(46,77,61,0.42)] sm:p-3"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        <div
          className="flex items-center justify-between gap-3 border-b px-3 py-3 sm:px-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--surface-2)", color: "var(--primary)" }}
            >
              <Terminal className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[0.68rem] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">
                {BRAND.company} App Tour
              </p>
              <p className="truncate text-sm font-black text-[var(--text-primary)]">{activeProduct.name}</p>
            </div>
          </div>
          <div
            className="hidden shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.18em] sm:flex"
            style={{ borderColor: "var(--border-strong)", color: "var(--primary)" }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} />
            Live UI
          </div>
        </div>

        <div className="grid min-w-0 gap-3 p-3 lg:p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Chọn sản phẩm để xem ảnh chụp app">
            {showcaseProducts.map((product) => (
              <ProductRailButton
                key={product.id}
                product={product}
                isActive={product.id === activeProduct.id}
                onSelect={() => setActiveId(product.id)}
              />
            ))}
          </div>

          <div className="min-w-0 overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
            <div
              className="flex items-center justify-between gap-3 border-b px-4 py-3"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="min-w-0">
                <p className="truncate text-[0.68rem] font-black uppercase tracking-[0.2em] text-[var(--primary)]">
                  {activeProduct.eyebrow}
                </p>
                <p className="truncate text-sm font-bold text-[var(--text-secondary)]">
                  Ảnh chụp từ màn hình sản phẩm đang chạy
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--danger)" }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--secondary)" }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--primary)" }} />
              </div>
            </div>

            <div className="relative aspect-[1.34/1] min-h-[320px] overflow-hidden lg:min-h-[410px]" style={{ background: "var(--bg-page)" }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeProduct.id}
                  className="absolute inset-0"
                  initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 18, scale: 0.985 }}
                  animate={
                    reduceMotion
                      ? { opacity: 1 }
                      : {
                          opacity: 1,
                          y: [0, -10, 0],
                          scale: [1.015, 1.04, 1.015],
                        }
                  }
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, scale: 1.01 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : {
                          opacity: { duration: 0.28, ease: "easeOut" },
                          y: { duration: 7.2, repeat: Infinity, ease: "easeInOut" },
                          scale: { duration: 7.2, repeat: Infinity, ease: "easeInOut" },
                        }
                  }
                >
                  <Image
                    src={activeProduct.image}
                    alt={`${activeProduct.name} trong ứng dụng ${BRAND.company}`}
                    fill
                    priority={activeProduct.id === showcaseProducts[0].id}
                    sizes="(min-width: 1280px) 56vw, (min-width: 1024px) 52vw, 100vw"
                    className="object-cover object-top"
                  />
                </motion.div>
              </AnimatePresence>

              {!reduceMotion ? (
                <>
                  <motion.span
                    key={`scan-${activeProduct.id}`}
                    aria-hidden="true"
                    className="absolute left-0 top-0 h-full w-20"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, color-mix(in srgb, var(--primary) 14%, transparent), transparent)",
                    }}
                    initial={{ x: "-120%" }}
                    animate={{ x: "720%" }}
                    transition={{ duration: 3.1, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.div
                    key={`cursor-${activeProduct.id}`}
                    aria-hidden="true"
                    className="absolute z-10 flex h-9 w-9 items-center justify-center rounded-full"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-strong)",
                      color: "var(--primary)",
                      boxShadow: "0 12px 28px rgba(28,43,34,0.18)",
                    }}
                    initial={{
                      left: activeProduct.pointerPath[0].x,
                      top: activeProduct.pointerPath[0].y,
                      opacity: 0,
                    }}
                    animate={{
                      left: activeProduct.pointerPath.map((point) => point.x),
                      top: activeProduct.pointerPath.map((point) => point.y),
                      opacity: [0, 1, 1, 1, 0.82],
                    }}
                    transition={{
                      duration: 5.2,
                      repeat: Infinity,
                      repeatType: "loop",
                      ease: "easeInOut",
                    }}
                  >
                    <MousePointer2 className="h-4 w-4" />
                    <motion.span
                      className="absolute inset-0 rounded-full"
                      style={{ border: "1px solid var(--primary)" }}
                      animate={{ scale: [0.75, 1.65], opacity: [0.45, 0] }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
                    />
                  </motion.div>
                </>
              ) : null}

              <div className="absolute bottom-3 left-3 right-3 z-20 flex justify-end">
                <div className="h-1.5 w-32 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                  <motion.span
                    key={progressKey}
                    className="block h-full origin-left rounded-full"
                    style={{ background: "var(--primary)" }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: reduceMotion || isPaused ? 1 : 1 }}
                    transition={{ duration: reduceMotion || isPaused ? 0 : TOUR_INTERVAL_MS / 1000, ease: "linear" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductRailButton({
  product,
  isActive,
  onSelect,
}: {
  product: HeroProduct;
  isActive: boolean;
  onSelect: () => void;
}) {
  const Icon = product.icon;

  return (
    <button
      type="button"
      className="group relative overflow-hidden rounded-xl border p-3 text-left transition-colors"
      style={{
        background: isActive ? "var(--surface-2)" : "var(--bg-surface)",
        borderColor: isActive ? "var(--border-strong)" : "var(--border)",
        color: "var(--text-primary)",
      }}
      onClick={onSelect}
      onMouseEnter={onSelect}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: isActive ? "var(--primary)" : "var(--surface-2)",
            color: isActive ? "var(--bg-page)" : "var(--primary)",
          }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{product.name}</p>
          <p className="truncate text-xs text-[var(--text-muted)]">{product.eyebrow}</p>
        </div>
      </div>
      {isActive ? (
        <motion.span
          layoutId="active-product-rail"
          className="absolute bottom-0 left-0 h-1 w-full"
          style={{ background: "var(--primary)" }}
        />
      ) : null}
    </button>
  );
}
