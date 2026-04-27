import {
  Activity,
  Bell,
  Bot,
  Briefcase,
  CheckCircle2,
  FlaskConical,
  Gauge,
  LineChart,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ProductScene } from "@/lib/brand/nexsuite";
import { PRODUCT_NAMES } from "@/lib/brand/productNames";

type Props = {
  scene: ProductScene;
  compact?: boolean;
};

const bars = [46, 68, 55, 78, 60, 88, 72, 82, 58, 92, 70, 80];
const signals = ["HAH", "MWG", "FPT", "VRE"];
const rankRows = [
  ["FPT", "88"],
  ["MWG", "82"],
  ["TCB", "76"],
  ["HPG", "71"],
];

export function ProductSceneVisual({ scene, compact = false }: Props) {
  if (scene === "pulse") {
    return (
      <SceneFrame compact={compact} eyebrow={PRODUCT_NAMES.market} title="Buc tranh thi truong">
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
                VNINDEX
              </p>
              <p className="mt-1 text-3xl font-black" style={{ color: "var(--text-primary)" }}>
                1,824.6
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-sm font-black text-emerald-600">+0.42%</span>
          </div>
          <div className="mt-6 flex h-44 items-end gap-2 rounded-3xl bg-[var(--surface-2)] p-4">
            {bars.map((height, index) => (
              <span
                key={index}
                className="flex-1 rounded-t-xl"
                style={{ height: `${height}%`, background: index % 3 === 0 ? "#22c55e" : index % 3 === 1 ? "#f59e0b" : "var(--primary)" }}
              />
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {["HOSE 18,420 ty", "HNX 1,120 ty", "UPCOM 840 ty"].map((item) => (
            <div key={item} className="rounded-2xl border bg-white p-4 text-sm font-black dark:bg-white/5" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
              {item}
            </div>
          ))}
        </div>
      </SceneFrame>
    );
  }

  if (scene === "pilot" || scene === "radar") {
    return (
      <SceneFrame compact={compact} eyebrow={scene === "pilot" ? PRODUCT_NAMES.aiBroker : PRODUCT_NAMES.signals} title="Co hoi co trang thai">
        <div className="grid gap-4 sm:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.75rem] border bg-[var(--surface-2)] p-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Tin hieu moi
            </p>
            <div className="mt-4 space-y-3">
              {signals.map((ticker, index) => (
                <div key={ticker} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 dark:bg-white/5">
                  <div>
                    <p className="font-black" style={{ color: "var(--text-primary)" }}>
                      {ticker}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {index % 2 ? "Dang theo doi" : "Moi phat sinh"}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-black text-emerald-600">Fresh</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[1.75rem] border bg-white p-5 dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Boi canh truoc hanh dong
            </p>
            <p className="mt-4 text-5xl font-black" style={{ color: "var(--text-primary)" }}>
              HAH
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              Ty trong tham khao 8.7% NAV
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {["Entry 56.0", "Muc tieu 59.9", "Sai diem 54.3"].map((item) => (
                <div key={item} className="rounded-2xl border p-4 text-center text-sm font-black" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </SceneFrame>
    );
  }

  if (scene === "art" || scene === "guard") {
    return (
      <SceneFrame compact={compact} eyebrow={scene === "art" ? PRODUCT_NAMES.art : PRODUCT_NAMES.risk} title={scene === "art" ? "Action - Risk - Trend" : "Lop kiem soat rui ro"}>
        <div className="grid gap-4 sm:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[1.75rem] border bg-[var(--surface-2)] p-8 text-center" style={{ borderColor: "var(--border)" }}>
            <div className="mx-auto h-44 w-44 rounded-full border-[18px] border-emerald-500 border-r-orange-400 border-t-red-500" />
            <p className="mt-4 text-5xl font-black" style={{ color: "var(--text-primary)" }}>
              2.70
            </p>
            <p className="text-lg font-black text-amber-500">Trung tinh</p>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Khong hien thi cong thuc noi bo tren UI public.
            </p>
          </div>
          <div className="space-y-3">
            {["Theo doi them", "Khong mua duoi", "Kiem tra vi the", "Cho xac nhan"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-2xl border bg-white p-4 dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
                <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                  {item}
                </span>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
            ))}
          </div>
        </div>
      </SceneFrame>
    );
  }

  if (scene === "rank") {
    return (
      <SceneFrame compact={compact} eyebrow={PRODUCT_NAMES.rank} title="Bang suc manh tuong doi">
        <div className="rounded-[1.75rem] border bg-white p-5 dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
          <div className="space-y-4">
            {rankRows.map(([ticker, score]) => (
              <div key={ticker}>
                <div className="mb-2 flex items-center justify-between text-sm font-black" style={{ color: "var(--text-primary)" }}>
                  <span>{ticker}</span>
                  <span>{score}</span>
                </div>
                <div className="h-3 rounded-full bg-[var(--surface-2)]">
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </SceneFrame>
    );
  }

  if (scene === "link" || scene === "vault") {
    return (
      <SceneFrame compact={compact} eyebrow={scene === "link" ? PRODUCT_NAMES.broker : PRODUCT_NAMES.portfolio} title={scene === "link" ? "Broker workflow pilot" : "Danh muc trong ngu canh"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard icon={<WalletCards />} title="NAV minh hoa" value="450 trieu" note="Preview, khong goi DNSE runtime o public." />
          <InfoCard icon={<Briefcase />} title="Vi the" value="6 ma" note="Theo doi ty trong va PnL." />
          <InfoCard icon={<ShieldCheck />} title="Trang thai" value={scene === "link" ? "Pilot" : "Safe"} note="Khong tu dong dat lenh cong khai." />
          <InfoCard icon={<Gauge />} title="Phien" value="OTP/session" note="Can xac thuc khi ap dung." />
        </div>
      </SceneFrame>
    );
  }

  if (scene === "lab" || scene === "flow" || scene === "sentinel") {
    const Icon = scene === "lab" ? FlaskConical : scene === "sentinel" ? Bell : LineChart;
    return (
      <SceneFrame compact={compact} eyebrow={scene === "lab" ? PRODUCT_NAMES.backtest : scene === "sentinel" ? PRODUCT_NAMES.alerts : PRODUCT_NAMES.workflow} title="Theo doi co bang chung">
        <div className="rounded-[1.75rem] border bg-white p-6 dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
          <Icon className="h-10 w-10 text-[var(--primary)]" />
          <div className="mt-6 grid gap-3">
            {["Kich ban", "Ket qua", "Rui ro", "Nhat ky"].map((item, index) => (
              <div key={item} className="flex items-center justify-between rounded-2xl bg-[var(--surface-2)] px-4 py-3">
                <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                  {item}
                </span>
                <span className="text-xs font-black" style={{ color: "var(--text-muted)" }}>0{index + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </SceneFrame>
    );
  }

  if (scene === "advisory") {
    return (
      <SceneFrame compact={compact} eyebrow={PRODUCT_NAMES.advisoryShort} title="Chat nhu mot ung dung nhan tin">
        <div className="rounded-[1.75rem] border bg-white p-5 dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: "var(--border)" }}>
            <Bot className="h-8 w-8 text-[var(--primary)]" />
            <div>
              <p className="font-black" style={{ color: "var(--text-primary)" }}>Tu van dau tu</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>AIDEN dang san sang</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <div className="ml-auto max-w-[75%] rounded-3xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white">So sanh TCB va EIB giup toi.</div>
            <div className="max-w-[82%] rounded-3xl bg-[var(--surface-2)] px-5 py-3 text-sm" style={{ color: "var(--text-primary)" }}>AIDEN tach boi canh ky thuat, co ban, dong tien va rui ro. Du lieu nao thieu se duoc ghi ro.</div>
            <div className="ml-auto max-w-[75%] rounded-3xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white">MCP la gi?</div>
            <div className="max-w-[82%] rounded-3xl bg-[var(--surface-2)] px-5 py-3 text-sm" style={{ color: "var(--text-primary)" }}>Day la cau hoi thuong. AIDEN tra loi truc tiep, khong ep thanh ma co phieu.</div>
          </div>
        </div>
      </SceneFrame>
    );
  }

  return (
    <SceneFrame compact={compact} eyebrow={PRODUCT_NAMES.stock} title="Khong gian phan tich co phieu">
      <div className="rounded-[1.75rem] border bg-white p-6 dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
        <p className="text-5xl font-black" style={{ color: "var(--text-primary)" }}>HPG</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {["Ky thuat", "Co ban", "Tin tuc", "Tam ly"].map((item) => (
            <div key={item} className="rounded-2xl bg-[var(--surface-2)] p-4 font-bold" style={{ color: "var(--text-primary)" }}>
              {item}
            </div>
          ))}
        </div>
      </div>
    </SceneFrame>
  );
}

function SceneFrame({ eyebrow, title, compact, children }: { eyebrow: string; title: string; compact: boolean; children: ReactNode }) {
  return (
    <div
      className={`rounded-[2rem] border bg-white/80 p-4 shadow-2xl shadow-black/10 backdrop-blur dark:bg-white/5 ${compact ? "" : "sm:p-6 lg:p-8"}`}
      style={{ borderColor: "var(--border)" }}
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="rounded-2xl bg-[var(--surface-2)] p-3">
          <Activity className="h-5 w-5 text-[var(--primary)]" />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>{eyebrow}</p>
          <h3 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>{title}</h3>
        </div>
      </div>
      {children}
    </div>
  );
}

function InfoCard({ icon, title, value, note }: { icon: ReactNode; title: string; value: string; note: string }) {
  return (
    <div className="rounded-3xl border bg-white p-5 dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
      <div className="h-6 w-6 text-[var(--primary)]">{icon}</div>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>{title}</p>
      <p className="mt-2 text-3xl font-black" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>{note}</p>
    </div>
  );
}
