import type { CSSProperties, ReactNode } from "react";

export type BriefImageKind = "morning" | "eod";

export const BRIEF_IMAGE_WIDTH = 1080;
export const BRIEF_IMAGE_HEIGHT = 1350;

type NormalizedIndex = {
  name: string;
  value: number | null;
  changePct: number | null;
};

type NormalizedMorningBrief = {
  date: string;
  indices: NormalizedIndex[];
  market: string[];
  macro: string[];
  riskOpportunity: string[];
};

type NormalizedEodBrief = {
  date: string;
  vnindex: number | null;
  changePct: number | null;
  totalLiquidity: number | null;
  matchedLiquidity: number | null;
  negotiatedLiquidity: number | null;
  exchangeLiquidity: Record<string, number | null>;
  breadth: { up: number | null; down: number | null; unchanged: number | null };
  summary: string;
  foreignFlow: string;
  notableTrades: string;
  liquidityDetail: string;
  outlook: string;
  subIndices: string[];
  foreignTopBuy: string[];
  foreignTopSell: string[];
  propTopBuy: string[];
  propTopSell: string[];
  individualTopBuy: string[];
  individualTopSell: string[];
  sectorGainers: string[];
  sectorLosers: string[];
  buySignals: string[];
  sellSignals: string[];
  topBreakout: string[];
  topNewHigh: string[];
};

const pageStyle: CSSProperties = {
  width: BRIEF_IMAGE_WIDTH,
  height: BRIEF_IMAGE_HEIGHT,
  display: "flex",
  flexDirection: "column",
  position: "relative",
  overflow: "hidden",
  backgroundColor: "#111317",
  color: "#f6f1e8",
  fontFamily: "Arial, Helvetica, sans-serif",
  padding: 44,
  boxSizing: "border-box",
};

const cardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  background: "rgba(25, 28, 34, 0.76)",
  borderRadius: 26,
  boxShadow: "0 24px 70px rgba(0, 0, 0, 0.36)",
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
}

function text(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item))
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function limitText(value: string, max = 128) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}...`;
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).format(date);
  }
  return value;
}

function formatNumber(value: number | null, digits = 1) {
  if (value == null) return "-";
  return value.toLocaleString("vi-VN", { maximumFractionDigits: digits });
}

function formatBillion(value: number | null) {
  if (value == null) return "-";
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
}

function normalizeMorningBrief(value: unknown): NormalizedMorningBrief {
  const source = record(value);
  return {
    date: text(source.date),
    indices: rows(source.reference_indices).map((item) => ({
      name: text(item.name).toUpperCase(),
      value: numberValue(item.value),
      changePct: numberValue(item.change_pct),
    })),
    market: textList(source.vn_market).slice(0, 4),
    macro: textList(source.macro).slice(0, 4),
    riskOpportunity: textList(source.risk_opportunity).slice(0, 4),
  };
}

function normalizeEodBrief(value: unknown): NormalizedEodBrief {
  const source = record(value);
  const breadth = record(source.breadth);
  const exchange = record(source.liquidity_by_exchange);
  return {
    date: text(source.date),
    vnindex: numberValue(source.vnindex),
    changePct: numberValue(source.change_pct),
    totalLiquidity: numberValue(source.total_liquidity ?? source.liquidity),
    matchedLiquidity: numberValue(source.matched_liquidity),
    negotiatedLiquidity: numberValue(source.negotiated_liquidity),
    exchangeLiquidity: {
      HoSE: numberValue(exchange.HOSE ?? exchange.HoSE ?? exchange.hose),
      HNX: numberValue(exchange.HNX ?? exchange.hnx),
      UPCoM: numberValue(exchange.UPCOM ?? exchange.UPCoM ?? exchange.upcom),
    },
    breadth: {
      up: numberValue(breadth.up),
      down: numberValue(breadth.down),
      unchanged: numberValue(breadth.unchanged),
    },
    summary: text(source.session_summary),
    foreignFlow: text(source.foreign_flow),
    notableTrades: text(source.notable_trades),
    liquidityDetail: text(source.liquidity_detail),
    outlook: text(source.outlook),
    subIndices: rows(source.sub_indices)
      .slice(0, 4)
      .map((item) => {
        const name = text(item.name).toUpperCase();
        const pts = numberValue(item.change_pts);
        const pct = numberValue(item.change_pct);
        return `${name}: ${formatNumber(pts, 2)} điểm / ${formatNumber(pct, 2)}%`;
      }),
    foreignTopBuy: textList(source.foreign_top_buy).slice(0, 4),
    foreignTopSell: textList(source.foreign_top_sell).slice(0, 4),
    propTopBuy: textList(source.prop_trading_top_buy).slice(0, 4),
    propTopSell: textList(source.prop_trading_top_sell).slice(0, 4),
    individualTopBuy: textList(source.individual_top_buy).slice(0, 4),
    individualTopSell: textList(source.individual_top_sell).slice(0, 4),
    sectorGainers: textList(source.sector_gainers).slice(0, 5),
    sectorLosers: textList(source.sector_losers).slice(0, 5),
    buySignals: textList(source.buy_signals).slice(0, 6),
    sellSignals: textList(source.sell_signals).slice(0, 6),
    topBreakout: textList(source.top_breakout).slice(0, 7),
    topNewHigh: textList(source.top_new_high).slice(0, 4),
  };
}

function Badge({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "gold" | "red" | "blue" }) {
  const colors = {
    green: ["rgba(0, 180, 110, 0.18)", "#39d98a"],
    gold: ["rgba(214, 168, 70, 0.18)", "#f0bd61"],
    red: ["rgba(235, 89, 72, 0.18)", "#ff907f"],
    blue: ["rgba(94, 108, 255, 0.18)", "#8b94ff"],
  }[tone];
  return (
    <div
      style={{
        display: "flex",
        padding: "8px 14px",
        borderRadius: 999,
        background: colors[0],
        color: colors[1],
        fontSize: 20,
        fontWeight: 800,
        letterSpacing: 0.5,
      }}
    >
      {children}
    </div>
  );
}

function Header({ title, subtitle, date }: { title: string; subtitle: string; date: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", color: "#c5d4c6", fontSize: 16, fontWeight: 800, letterSpacing: 7, marginBottom: 10 }}>
          ADN CAPITAL
        </div>
        <div style={{ display: "flex", fontSize: 42, fontWeight: 900, lineHeight: 1.05 }}>{title}</div>
        <div style={{ display: "flex", color: "#aeb4ae", fontSize: 22, marginTop: 8 }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
        <Badge>FRESH</Badge>
        <div style={{ display: "flex", color: "#d7d0c2", fontSize: 24, fontWeight: 700 }}>{formatDate(date)}</div>
      </div>
    </div>
  );
}

function Backdrop() {
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: -140,
          top: -160,
          width: 460,
          height: 460,
          borderRadius: 460,
          backgroundColor: "rgba(64, 120, 100, 0.18)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -120,
          top: -110,
          width: 390,
          height: 390,
          borderRadius: 390,
          backgroundColor: "rgba(190, 148, 63, 0.12)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 120,
          bottom: -210,
          width: 520,
          height: 520,
          borderRadius: 520,
          backgroundColor: "rgba(96, 102, 255, 0.10)",
        }}
      />
    </>
  );
}

function Section({ title, children, style }: { title: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ ...cardStyle, padding: 24, gap: 12, flex: 1, ...style }}>
      <div style={{ display: "flex", color: "#8b94ff", fontSize: 20, fontWeight: 900, letterSpacing: 1.3, textTransform: "uppercase" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function BulletList({
  items,
  color = "#f1eadf",
  max = 3,
  limit = 120,
  fontSize = 22,
}: {
  items: string[];
  color?: string;
  max?: number;
  limit?: number;
  fontSize?: number;
}) {
  const usable = items.slice(0, max);
  if (!usable.length) {
    return <div style={{ display: "flex", color: "#a6aca6", fontSize: 24 }}>Đang chờ cập nhật nội dung.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {usable.map((item, index) => (
        <div key={`${item}-${index}`} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "flex", width: 8, height: 8, borderRadius: 8, background: color, marginTop: 10 }} />
          <div style={{ display: "flex", color: "#eee8dd", fontSize, lineHeight: 1.28, flex: 1 }}>{limitText(item, limit)}</div>
        </div>
      ))}
    </div>
  );
}

function FlowRow({
  label,
  primary,
  buy,
  sell,
  tone = "gold",
}: {
  label: string;
  primary?: string;
  buy?: string[];
  sell?: string[];
  tone?: "green" | "gold" | "red" | "blue";
}) {
  return (
    <div style={{ display: "flex", height: 92, overflow: "hidden", borderTop: "1px solid rgba(255,255,255,0.09)" }}>
      <div style={{ display: "flex", width: 212, padding: "15px 18px", color: "#c9c3b8", fontSize: 20, fontWeight: 800, lineHeight: 1.25, background: "rgba(255,255,255,0.035)" }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "13px 18px", gap: 6, overflow: "hidden" }}>
        {primary ? (
          <div style={{ display: "flex", color: "#eee8dd", fontSize: 19, lineHeight: 1.2 }}>
            <span style={{ color: tone === "green" ? "#39d98a" : tone === "red" ? "#ff907f" : tone === "blue" ? "#80a1ff" : "#f0bd61", fontWeight: 900 }}>
              Tổng hợp:&nbsp;
            </span>
            {limitText(primary, 98)}
          </div>
        ) : null}
        {buy && buy.length ? (
          <div style={{ display: "flex", color: "#eee8dd", fontSize: 19, lineHeight: 1.2 }}>
            <span style={{ color: "#39d98a", fontWeight: 900 }}>Mua nổi bật:&nbsp;</span>
            {limitText(buy.join(", "), 98)}
          </div>
        ) : null}
        {sell && sell.length ? (
          <div style={{ display: "flex", color: "#eee8dd", fontSize: 19, lineHeight: 1.2 }}>
            <span style={{ color: "#ff907f", fontWeight: 900 }}>Bán nổi bật:&nbsp;</span>
            {limitText(sell.join(", "), 98)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MorningImage({ data }: { data: NormalizedMorningBrief }) {
  const firstIndex = data.indices[0];
  const changeTone = (firstIndex?.changePct ?? 0) >= 0 ? "green" : "red";
  return (
    <div style={pageStyle}>
      <Header title="Bản Tin Sáng" subtitle="Morning Brief - cập nhật thị trường" date={data.date} />

      <div style={{ display: "flex", gap: 16, height: 138, marginBottom: 20 }}>
        {data.indices.slice(0, 5).map((item) => {
          const positive = (item.changePct ?? 0) >= 0;
          return (
            <div key={item.name} style={{ ...cardStyle, flex: 1, height: 138, padding: 18, gap: 8 }}>
              <div style={{ display: "flex", color: "#aeb4ae", fontSize: 17, fontWeight: 800 }}>{item.name}</div>
              <div style={{ display: "flex", color: "#f6f1e8", fontSize: 28, fontWeight: 900 }}>{formatNumber(item.value, 2)}</div>
              <div style={{ display: "flex", color: positive ? "#39d98a" : "#ff907f", fontSize: 19, fontWeight: 900 }}>
                {positive ? "+" : ""}
                {formatNumber(item.changePct, 2)}%
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ ...cardStyle, height: 118, padding: 24, marginBottom: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", color: "#8b94ff", fontSize: 20, fontWeight: 900, letterSpacing: 1.4 }}>ADN CAPITAL FLASHNOTE</div>
          <div style={{ display: "flex", color: "#eee8dd", fontSize: 28, fontWeight: 900 }}>
            {firstIndex?.name || "VNINDEX"} {formatNumber(firstIndex?.value ?? null, 2)}
          </div>
        </div>
        <Badge tone={changeTone}>{formatNumber(firstIndex?.changePct ?? null, 2)}%</Badge>
      </div>

      <div style={{ display: "flex", gap: 20, height: 335, marginBottom: 20 }}>
        <Section title="Thị trường Việt Nam">
          <BulletList items={data.market} color="#39d98a" max={3} limit={118} />
        </Section>
        <Section title="Vĩ mô">
          <BulletList items={data.macro} color="#f0bd61" max={3} limit={118} />
        </Section>
      </div>

      <div style={{ display: "flex", height: 305 }}>
        <Section title="Rủi ro / Cơ hội">
          <BulletList items={data.riskOpportunity} color="#8b94ff" max={3} limit={152} />
        </Section>
      </div>

      <div style={{ display: "flex", justifyContent: "center", color: "#aeb4ae", fontSize: 20, fontWeight: 800, marginTop: 22 }}>
        ADNCAPITAL.COM.VN
      </div>
    </div>
  );
}

function EodImage({ data }: { data: NormalizedEodBrief }) {
  const negative = (data.changePct ?? 0) < 0;
  const exchange = data.exchangeLiquidity;
  return (
    <div style={pageStyle}>
      <Header title="Bản Tin Tổng Hợp" subtitle="End-of-day Brief - tổng kết giao dịch" date={data.date} />

      <div style={{ ...cardStyle, height: 104, padding: 24, marginBottom: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", color: "#aeb4ae", fontSize: 20, fontWeight: 800 }}>VNINDEX</div>
          <div style={{ display: "flex", color: "#f6f1e8", fontSize: 38, fontWeight: 900 }}>{formatNumber(data.vnindex, 2)}</div>
        </div>
        <Badge tone={negative ? "red" : "green"}>
          {negative ? "" : "+"}
          {formatNumber(data.changePct, 2)}%
        </Badge>
      </div>

      <div style={{ ...cardStyle, height: 142, padding: 22, marginBottom: 18, gap: 12 }}>
        <div style={{ display: "flex", color: "#8b94ff", fontSize: 20, fontWeight: 900, letterSpacing: 1.4 }}>ADN CAPITAL FLASHNOTE</div>
        <div style={{ display: "flex", gap: 14 }}>
          <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", color: "#eee8dd", fontSize: 21, lineHeight: 1.25 }}>
              Thanh khoản toàn thị trường đạt&nbsp;<span style={{ color: "#7f87ff", fontWeight: 900 }}>{formatBillion(data.totalLiquidity)}</span>.
            </div>
            <div style={{ display: "flex", color: "#d7d0c2", fontSize: 19, lineHeight: 1.25 }}>
              Khớp lệnh: {formatBillion(data.matchedLiquidity)} · Thỏa thuận: {formatBillion(data.negotiatedLiquidity)}
            </div>
          </div>
          <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", color: "#d7d0c2", fontSize: 19, lineHeight: 1.25 }}>
              HoSE {formatBillion(exchange.HoSE)} · HNX {formatBillion(exchange.HNX)}
            </div>
            <div style={{ display: "flex", color: "#d7d0c2", fontSize: 19, lineHeight: 1.25 }}>
              UPCoM {formatBillion(exchange.UPCoM)} · Độ rộng: {data.breadth.up ?? "-"} tăng / {data.breadth.down ?? "-"} giảm
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, height: 616, marginBottom: 18 }}>
        <div style={{ display: "flex", padding: "16px 22px", background: "rgba(96, 102, 255, 0.12)", color: "#8b94ff", fontSize: 20, fontWeight: 900, letterSpacing: 1.3 }}>
          BẢNG DÒNG TIỀN CHI TIẾT
        </div>
        <FlowRow label="Giao dịch khối ngoại" primary={data.foreignFlow} buy={data.foreignTopBuy} sell={data.foreignTopSell} tone="gold" />
        <FlowRow label="Giao dịch tự doanh" primary={data.notableTrades} buy={data.propTopBuy} sell={data.propTopSell} tone="blue" />
        <FlowRow label="Giao dịch cá nhân" primary={data.liquidityDetail} buy={data.individualTopBuy} sell={data.individualTopSell} tone="green" />
        <FlowRow label="Ảnh hưởng chỉ số" buy={data.sectorGainers} sell={data.sectorLosers} tone="green" />
        <FlowRow label="Tín hiệu chủ động" buy={data.buySignals} sell={data.sellSignals} tone="green" />
        <FlowRow label="Đột phá / Vượt đỉnh" primary={data.topBreakout.length ? data.topBreakout.join(", ") : ""} buy={data.topNewHigh} tone="gold" />
      </div>

      <div style={{ ...cardStyle, height: 166, padding: 22, gap: 10 }}>
        <div style={{ display: "flex", color: "#8b94ff", fontSize: 20, fontWeight: 900, letterSpacing: 1.4 }}>NHẬN ĐỊNH PHIÊN TỚI</div>
        <div style={{ display: "flex", color: "#eee8dd", fontSize: 23, lineHeight: 1.3, fontStyle: "italic" }}>
          {limitText(data.outlook || data.summary || "Bản tin đang chờ cập nhật nhận định phiên tới.", 180)}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", color: "#aeb4ae", fontSize: 20, fontWeight: 800, marginTop: 22 }}>
        ADNCAPITAL.COM.VN
      </div>
    </div>
  );
}

export function renderBriefImage(kind: BriefImageKind, value: unknown) {
  return kind === "morning" ? <MorningImage data={normalizeMorningBrief(value)} /> : <EodImage data={normalizeEodBrief(value)} />;
}

export function briefImageCaption(kind: BriefImageKind, value: unknown) {
  const date = kind === "morning" ? normalizeMorningBrief(value).date : normalizeEodBrief(value).date;
  const title = kind === "morning" ? "Bản tin sáng ADN Capital" : "Bản tin tổng hợp ADN Capital";
  return `${title}${date ? ` - ${formatDate(date)}` : ""}`;
}
