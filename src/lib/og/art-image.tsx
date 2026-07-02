import { ImageResponse } from "next/og";
import { loadBriefFonts } from "@/lib/n8n/brief-image-render";

// Gradient thuận-trend: thấp = hoảng loạn/yếu (đỏ) → cao = trend khỏe (xanh).
const TEI_COLORS: [number, [number, number, number]][] = [
  [0.0, [220, 38, 38]], [0.2, [239, 68, 68]], [0.35, [249, 115, 22]],
  [0.5, [234, 179, 8]], [0.7, [163, 230, 53]], [0.85, [74, 222, 128]], [1.0, [22, 163, 74]],
];

function interpolateColor(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  for (let i = 0; i < TEI_COLORS.length - 1; i++) {
    const [t0, c0] = TEI_COLORS[i];
    const [t1, c1] = TEI_COLORS[i + 1];
    if (c >= t0 && c <= t1) {
      const f = (c - t0) / (t1 - t0);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * f);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * f);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * f);
      return `rgb(${r},${g},${b})`;
    }
  }
  const last = TEI_COLORS[TEI_COLORS.length - 1][1];
  return `rgb(${last[0]},${last[1]},${last[2]})`;
}

/** Đồng hồ gauge ART 0–5 (port từ GaugeSVG web) → chuỗi SVG. */
export function buildGaugeSvg(value: number): string {
  const clamped = Math.max(0, Math.min(5, Number.isFinite(value) ? value : 0));
  const cx = 150, cy = 140, r = 110, strokeW = 22, SEG = 60;
  let arcs = "";
  for (let i = 0; i < SEG; i++) {
    const sf = i / SEG, ef = (i + 1) / SEG;
    const sa = Math.PI - sf * Math.PI, ea = Math.PI - ef * Math.PI;
    const x1 = cx + r * Math.cos(sa), y1 = cy - r * Math.sin(sa);
    const x2 = cx + r * Math.cos(ea), y2 = cy - r * Math.sin(ea);
    const cap = i === 0 || i === SEG - 1 ? "round" : "butt";
    arcs += `<path d="M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 0 ${x2.toFixed(2)} ${y2.toFixed(2)}" fill="none" stroke="${interpolateColor((sf + ef) / 2)}" stroke-width="${strokeW}" stroke-linecap="${cap}"/>`;
  }
  let ticks = "";
  for (const t of [0, 1, 2, 3, 4, 5]) {
    const a = Math.PI - (t / 5) * Math.PI;
    const lx = cx + (r + 20) * Math.cos(a), ly = cy - (r + 20) * Math.sin(a);
    ticks += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="central" fill="#9CA3AF" font-size="14" font-weight="700">${t}</text>`;
  }
  const na = Math.PI - (clamped / 5) * Math.PI, nl = r - 30;
  const nx = cx + nl * Math.cos(na), ny = cy - nl * Math.sin(na);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 170" width="300" height="170">${arcs}${ticks}<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(2)}" y2="${ny.toFixed(2)}" stroke="#ECE7DB" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="7" fill="#ECE7DB"/><circle cx="${cx}" cy="${cy}" r="3" fill="#12161d"/></svg>`;
}

export type ArtImageData = {
  ticker: string;
  value: number | null;
  ma7: number | null;
  classification: string | null;
  classColor: string | null;
  date: string | null;
  /** Badge bắt đáy (hoảng loạn + đã ổn định / chưa ổn định) — từ detectBottomSignal. */
  bottomSignal?: "none" | "panic_wait" | "bottom_signal";
};

const CLASS_COLOR_HEX: Record<string, string> = { green: "#22C55E", red: "#EF4444", yellow: "#EAB308" };

export async function renderArtImageBuffer(d: ArtImageData): Promise<ArrayBuffer> {
  const fonts = loadBriefFonts();
  const value = d.value ?? 0;
  const color = CLASS_COLOR_HEX[d.classColor || ""] || d.classColor || "#ECE7DB";
  const gauge = `data:image/svg+xml;base64,${Buffer.from(buildGaugeSvg(value)).toString("base64")}`;
  const el = (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#12161d", padding: "34px 44px", fontFamily: "Manrope", color: "#ECE7DB" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>🎯 ADN ART</div>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800, letterSpacing: 3 }}>{d.ticker}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={gauge} width={470} height={266} alt="gauge" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: -4 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
          <div style={{ display: "flex", fontSize: 74, fontWeight: 800, color }}>{value.toFixed(2)}</div>
          <div style={{ display: "flex", fontSize: 26, color: "#8b9085", marginBottom: 14 }}>ĐIỂM</div>
        </div>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color, letterSpacing: 4 }}>{d.classification || ""}</div>
        {d.bottomSignal === "bottom_signal" ? (
          <div style={{ display: "flex", fontSize: 19, fontWeight: 800, color: "#22C55E", marginTop: 8, padding: "4px 14px", border: "1px solid rgba(34,197,94,0.45)", borderRadius: 999, background: "rgba(34,197,94,0.12)" }}>
            ⚡ BẮT ĐÁY — hoảng loạn đã ổn định
          </div>
        ) : null}
        {d.bottomSignal === "panic_wait" ? (
          <div style={{ display: "flex", fontSize: 19, fontWeight: 700, color: "#EF4444", marginTop: 8, padding: "4px 14px", border: "1px solid rgba(239,68,68,0.40)", borderRadius: 999, background: "rgba(239,68,68,0.10)" }}>
            ⏳ Hoảng loạn — chưa ổn định, chưa vào
          </div>
        ) : null}
        <div style={{ display: "flex", fontSize: 18, color: "#8b9085", marginTop: 10 }}>
          MA7 {d.ma7 != null ? Number(d.ma7).toFixed(2) : "—"}  ·  cập nhật {d.date || ""}
        </div>
      </div>
    </div>
  );
  const res = new ImageResponse(el, { width: 640, height: 520, fonts: fonts.length ? fonts : undefined });
  return res.arrayBuffer();
}
