// ADN native chart — drawing engine (custom canvas primitives cho lightweight-charts v5).
//
// Mỗi nét vẽ được neo theo {time, price} (KHÔNG phải % màn hình) nên dính chặt vào nến
// khi pan/zoom. Toàn bộ nét vẽ do MỘT primitive gắn vào candle series vẽ ra; primitive
// được render-loop của chart gọi lại mỗi frame → không cần subscribe/repaint thủ công.

import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from "lightweight-charts";

export type DrawTool =
  | "trend"
  | "ray"
  | "hline"
  | "vline"
  | "zone"
  | "fib"
  | "channel"
  | "measure"
  | "text";

export type DrawAnchor = { time: number; price: number };

export type DrawObject = {
  id: string;
  tool: DrawTool;
  anchors: DrawAnchor[];
  text?: string;
  color?: string;
};

type CandleLike = { time: number };

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

const PALETTE = {
  trend: "#38bdf8",
  ray: "#38bdf8",
  channel: "#38bdf8",
  measure: "#38bdf8",
  hline: "#f59e0b",
  vline: "#f59e0b",
  zone: "#f59e0b",
  fib: "#22c55e",
  text: "#f59e0b",
};

// time -> chỉ số logical (có nội/ngoại suy) để nét vẽ không biến mất khi 1 đầu trôi khỏi màn.
function timeToLogical(candles: CandleLike[], time: number): number | null {
  const n = candles.length;
  if (n === 0) return null;
  const first = candles[0].time;
  const last = candles[n - 1].time;
  if (n === 1) return 0;
  if (time <= first) {
    const span = candles[1].time - first || 1;
    return (time - first) / span; // âm (ngoại suy về trái)
  }
  if (time >= last) {
    const span = last - candles[n - 2].time || 1;
    return n - 1 + (time - last) / span; // ngoại suy về phải
  }
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time <= time) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(0, lo - 1);
  const t0 = candles[i].time;
  const t1 = candles[i + 1].time;
  const frac = t1 > t0 ? (time - t0) / (t1 - t0) : 0;
  return i + frac;
}

export class DrawingsPrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApi | null = null;
  private _series: ISeriesApi<SeriesType> | null = null;
  private _requestUpdate?: () => void;
  private _drawings: DrawObject[] = [];
  private _preview: DrawObject | null = null;
  private readonly _getCandles: () => CandleLike[];
  private _isDark: boolean;
  private readonly _views: DrawingsPaneView[];

  constructor(opts: { getCandles: () => CandleLike[]; isDark: boolean }) {
    this._getCandles = opts.getCandles;
    this._isDark = opts.isDark;
    this._views = [new DrawingsPaneView(this)];
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this._chart = null;
    this._series = null;
    this._requestUpdate = undefined;
  }

  updateAllViews(): void {
    // renderer đọc dữ liệu live ngay trong draw(), không cần cache view.
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }

  setDrawings(drawings: DrawObject[]): void {
    this._drawings = drawings;
    this._requestUpdate?.();
  }

  setPreview(preview: DrawObject | null): void {
    this._preview = preview;
    this._requestUpdate?.();
  }

  setDark(isDark: boolean): void {
    this._isDark = isDark;
    this._requestUpdate?.();
  }

  // ── đọc cho renderer ──
  get drawings(): DrawObject[] {
    return this._drawings;
  }
  get preview(): DrawObject | null {
    return this._preview;
  }
  get isDark(): boolean {
    return this._isDark;
  }

  timeToX(time: number): number | null {
    const chart = this._chart;
    if (!chart) return null;
    const ts = chart.timeScale();
    const direct = ts.timeToCoordinate(time as Time);
    if (direct != null) return direct as number;
    const logical = timeToLogical(this._getCandles(), time);
    if (logical == null) return null;
    const x = ts.logicalToCoordinate(logical as never);
    return x == null ? null : (x as number);
  }

  priceToY(price: number): number | null {
    const y = this._series?.priceToCoordinate(price);
    return y == null ? null : (y as number);
  }
}

class DrawingsPaneView implements IPrimitivePaneView {
  constructor(private readonly _source: DrawingsPrimitive) {}

  zOrder() {
    return "top" as const;
  }

  renderer(): IPrimitivePaneRenderer {
    return new DrawingsRenderer(this._source);
  }
}

type Pt = { x: number; y: number };

class DrawingsRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _source: DrawingsPrimitive) {}

  draw(target: {
    useMediaCoordinateSpace: (cb: (scope: {
      context: CanvasRenderingContext2D;
      mediaSize: { width: number; height: number };
    }) => void) => void;
  }): void {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const list = this._source.drawings;
      for (const d of list) this._drawOne(ctx, d, mediaSize, false);
      if (this._source.preview) this._drawOne(ctx, this._source.preview, mediaSize, true);
    });
  }

  private _pt(anchor: DrawAnchor): Pt | null {
    const x = this._source.timeToX(anchor.time);
    const y = this._source.priceToY(anchor.price);
    if (x == null || y == null) return null;
    return { x, y };
  }

  private _drawOne(
    ctx: CanvasRenderingContext2D,
    d: DrawObject,
    size: { width: number; height: number },
    isPreview: boolean,
  ): void {
    const color = d.color || PALETTE[d.tool] || "#38bdf8";
    ctx.save();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    if (isPreview) ctx.globalAlpha = 0.75;

    const a = d.anchors[0] ? this._pt(d.anchors[0]) : null;
    const b = d.anchors[1] ? this._pt(d.anchors[1]) : null;
    const c = d.anchors[2] ? this._pt(d.anchors[2]) : null;

    switch (d.tool) {
      case "hline": {
        if (!a) break;
        ctx.setLineDash([6, 4]);
        seg(ctx, 0, a.y, size.width, a.y);
        ctx.setLineDash([]);
        label(ctx, fmt(d.anchors[0].price), size.width - 6, a.y - 4, color, "right");
        break;
      }
      case "vline": {
        if (!a) break;
        ctx.setLineDash([6, 4]);
        seg(ctx, a.x, 0, a.x, size.height);
        ctx.setLineDash([]);
        break;
      }
      case "trend": {
        if (!a || !b) break;
        seg(ctx, a.x, a.y, b.x, b.y);
        break;
      }
      case "ray": {
        if (!a || !b) break;
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const k = (size.width + size.height) / len + 2;
        seg(ctx, a.x, a.y, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);
        break;
      }
      case "zone": {
        if (!a || !b) break;
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const w = Math.abs(a.x - b.x);
        const h = Math.abs(a.y - b.y);
        ctx.globalAlpha = isPreview ? 0.12 : 0.14;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = isPreview ? 0.75 : 1;
        ctx.strokeRect(x, y, w, h);
        break;
      }
      case "fib": {
        if (!a || !b) break;
        const pa = d.anchors[0].price;
        const pb = d.anchors[1].price;
        const left = Math.min(a.x, b.x);
        ctx.setLineDash([5, 4]);
        for (const level of FIB_LEVELS) {
          const price = pa + (pb - pa) * level;
          const y = this._source.priceToY(price);
          if (y == null) continue;
          seg(ctx, left, y, size.width, y);
          label(ctx, `${(level * 100).toFixed(1)}%  ${fmt(price)}`, left + 4, y - 3, color, "left");
        }
        ctx.setLineDash([]);
        break;
      }
      case "channel": {
        if (!a || !b) break;
        seg(ctx, a.x, a.y, b.x, b.y);
        if (!c) break;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        seg(ctx, c.x, c.y, c.x + dx, c.y + dy);
        ctx.globalAlpha = isPreview ? 0.1 : 0.12;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x + dx, c.y + dy);
        ctx.lineTo(c.x, c.y);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "measure": {
        if (!a || !b) break;
        ctx.setLineDash([5, 4]);
        seg(ctx, a.x, a.y, b.x, b.y);
        ctx.setLineDash([]);
        const p0 = d.anchors[0].price;
        const p1 = d.anchors[1].price;
        const diff = p1 - p0;
        const pct = p0 ? (diff / p0) * 100 : 0;
        const text = `${diff >= 0 ? "+" : ""}${fmt(diff)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`;
        label(ctx, text, (a.x + b.x) / 2, (a.y + b.y) / 2 - 4, color, "center");
        break;
      }
      case "text": {
        if (!a) break;
        ctx.font = "700 13px Inter, system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(d.text || "", a.x, a.y);
        break;
      }
    }

    if (isPreview) {
      ctx.globalAlpha = 1;
      for (const anchor of d.anchors) {
        const pt = this._pt(anchor);
        if (!pt) continue;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function seg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  align: CanvasTextAlign,
): void {
  ctx.save();
  ctx.font = "600 10px Inter, system-ui, sans-serif";
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function fmt(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
  if (abs >= 100) return value.toFixed(1);
  return value.toFixed(2);
}
