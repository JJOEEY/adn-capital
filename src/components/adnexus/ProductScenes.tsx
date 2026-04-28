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
      <SceneFrame compact={compact} eyebrow={PRODUCT_NAMES.market} title="Bức tranh thị trường">
        <div className="rounded-[1.75rem] border p-5 shadow-sm" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
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
          {["HOSE 18,420 tỷ", "HNX 1,120 tỷ", "UPCOM 840 tỷ"].map((item) => (
            <div key={item} className="rounded-2xl border p-4 text-sm font-black" style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
              {item}
            </div>
          ))}
        </div>
      </SceneFrame>
    );
  }

  if (scene === "pilot" || scene === "radar") {
    return (
      <SceneFrame compact={compact} eyebrow={scene === "pilot" ? PRODUCT_NAMES.aiBroker : PRODUCT_NAMES.signals} title="Cơ hội có trạng thái">
        <div className="grid gap-4 sm:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.75rem] border bg-[var(--surface-2)] p-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Tín hiệu mới
            </p>
            <div className="mt-4 space-y-3">
              {signals.map((ticker, index) => (
                <div key={ticker} className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "var(--bg-surface)" }}>
                  <div>
                    <p className="font-black" style={{ color: "var(--text-primary)" }}>
                      {ticker}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {index % 2 ? "Đang theo dõi" : "Mới phát sinh"}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-black text-emerald-600">Fresh</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[1.75rem] border p-5" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Bối cảnh trước hành động
            </p>
            <p className="mt-4 text-5xl font-black" style={{ color: "var(--text-primary)" }}>
              HAH
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              Tỷ trọng tham khảo 8.7% NAV
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {["Entry 56.0", "Mục tiêu 59.9", "Sai điểm 54.3"].map((item) => (
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
      <SceneFrame compact={compact} eyebrow={scene === "art" ? PRODUCT_NAMES.art : PRODUCT_NAMES.risk} title={scene === "art" ? "Action - Risk - Trend" : "Lớp kiểm soát rủi ro"}>
        <div className="grid gap-4 sm:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[1.75rem] border bg-[var(--surface-2)] p-8 text-center" style={{ borderColor: "var(--border)" }}>
            <div className="mx-auto h-44 w-44 rounded-full border-[18px] border-emerald-500 border-r-orange-400 border-t-red-500" />
            <p className="mt-4 text-5xl font-black" style={{ color: "var(--text-primary)" }}>
              2.70
            </p>
            <p className="text-lg font-black text-amber-500">Trung tính</p>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Công thức định lượng không hiển thị trên giao diện public.
            </p>
          </div>
          <div className="space-y-3">
            {["Theo dõi thêm", "Không mua đuổi", "Kiểm tra vị thế", "Chờ xác nhận"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-2xl border p-4" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
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
      <SceneFrame compact={compact} eyebrow={PRODUCT_NAMES.rank} title="Bảng sức mạnh tương đối">
        <div className="rounded-[1.75rem] border p-5" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
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
      <SceneFrame compact={compact} eyebrow={scene === "link" ? PRODUCT_NAMES.broker : PRODUCT_NAMES.portfolio} title={scene === "link" ? "Broker workflow pilot" : "Danh mục trong ngữ cảnh"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard icon={<WalletCards />} title="NAV minh họa" value="450 triệu" note="Preview, không gọi DNSE runtime ở public." />
          <InfoCard icon={<Briefcase />} title="Vị thế" value="6 mã" note="Theo dõi tỷ trọng và PnL." />
          <InfoCard icon={<ShieldCheck />} title="Trạng thái" value={scene === "link" ? "Pilot" : "Safe"} note="Không tự động đặt lệnh công khai." />
          <InfoCard icon={<Gauge />} title="Phiên" value="OTP/session" note="Cần xác thực khi áp dụng." />
        </div>
      </SceneFrame>
    );
  }

  if (scene === "lab" || scene === "flow" || scene === "sentinel") {
    const Icon = scene === "lab" ? FlaskConical : scene === "sentinel" ? Bell : LineChart;
    return (
      <SceneFrame compact={compact} eyebrow={scene === "lab" ? PRODUCT_NAMES.backtest : scene === "sentinel" ? PRODUCT_NAMES.alerts : PRODUCT_NAMES.workflow} title="Theo dõi có bằng chứng">
        <div className="rounded-[1.75rem] border p-6" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
          <Icon className="h-10 w-10 text-[var(--primary)]" />
          <div className="mt-6 grid gap-3">
            {["Kịch bản", "Kết quả", "Rủi ro", "Nhật ký"].map((item, index) => (
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
      <SceneFrame compact={compact} eyebrow={PRODUCT_NAMES.advisoryShort} title="Chat như một ứng dụng nhắn tin">
        <div className="rounded-[1.75rem] border p-5" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: "var(--border)" }}>
            <Bot className="h-8 w-8 text-[var(--primary)]" />
            <div>
              <p className="font-black" style={{ color: "var(--text-primary)" }}>Tư vấn đầu tư</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>AIDEN đang sẵn sàng</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <div className="ml-auto max-w-[75%] rounded-3xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white">So sánh TCB và EIB giúp tôi.</div>
            <div className="max-w-[82%] rounded-3xl bg-[var(--surface-2)] px-5 py-3 text-sm" style={{ color: "var(--text-primary)" }}>AIDEN tách bối cảnh kỹ thuật, cơ bản, dòng tiền và rủi ro. Dữ liệu nào thiếu sẽ được ghi rõ.</div>
            <div className="ml-auto max-w-[75%] rounded-3xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white">MCP là gì?</div>
            <div className="max-w-[82%] rounded-3xl bg-[var(--surface-2)] px-5 py-3 text-sm" style={{ color: "var(--text-primary)" }}>Đây là câu hỏi thường. AIDEN trả lời trực tiếp, không ép thành mã cổ phiếu.</div>
          </div>
        </div>
      </SceneFrame>
    );
  }

  return (
    <SceneFrame compact={compact} eyebrow={PRODUCT_NAMES.stock} title="Không gian phân tích cổ phiếu">
      <div className="rounded-[1.75rem] border p-6" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <p className="text-5xl font-black" style={{ color: "var(--text-primary)" }}>HPG</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {["Kỹ thuật", "Cơ bản", "Tin tức", "Tâm lý"].map((item) => (
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
      className={`rounded-[2rem] border p-4 shadow-2xl shadow-black/10 ${compact ? "" : "sm:p-6 lg:p-8"}`}
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
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
    <div className="rounded-3xl border p-5" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
      <div className="h-6 w-6 text-[var(--primary)]">{icon}</div>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>{title}</p>
      <p className="mt-2 text-3xl font-black" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>{note}</p>
    </div>
  );
}
