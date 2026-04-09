export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  rsRating: number;
  sector: string;
}

export interface Signal {
  id: string;
  ticker: string;
  type: "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO" | "TAM_NGAM";
  status: "RADAR" | "ACTIVE" | "CLOSED";
  tier: "LEADER" | "TRUNG_HAN" | "NGAN_HAN" | "TAM_NGAM";
  entryPrice: number;
  target?: number | null;
  stoploss?: number | null;
  closePrice?: number | null;
  currentPrice?: number | null;
  currentPnl?: number | null;
  navAllocation: number;
  triggerSignal?: string | null;
  aiReasoning?: string | null;
  reason?: string | null;
  pnl?: number | null;
  closedReason?: string | null;
  winRate?: number | null;
  sharpeRatio?: number | null;
  closedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  createdAt: string;
  chartStock?: string;    // Mã cổ phiếu kèm chart (chỉ có khi dùng /ta)
  chartExchange?: string; // Sàn giao dịch: "HOSE" | "HNX" | "UPCOM"
  // Widget-in-Chat: Khi AI trả về dashboard cổ phiếu tương tác
  widgetData?: {
    type: "widget";
    widgetType: "TICKER_DASHBOARD";
    ticker: string;
    data: {
      technical: { stats: any; aiInsight: string | null };
      fundamental: { stats: any; aiInsight: string | null };
      news: { title: string; time: string; url?: string }[];
      behavior: { teiScore: number; status: string };
      signal?: any;
    };
  };
}

export interface JournalEntry {
  id: string;
  userId: string;
  ticker: string;
  action: "BUY" | "SELL";
  price: number;
  quantity: number;
  psychology: string;
  psychologyTag?: string | null;
  tradeReason?: string | null;
  tradeDate?: string | null;
  createdAt: string;
}

export type PsychologyTag = "Có kế hoạch" | "Tự tin" | "FOMO" | "Theo room" | "Cảm tính" | "Hoảng loạn";

export type UserRole = "GUEST" | "FREE" | "VIP" | "ADMIN";
export type SystemRole = "ADMIN" | "USER";

export interface MarketStatusData {
  status: "GOOD" | "BAD" | "NEUTRAL";
  description: string;
  indicators: {
    ema10AboveEma30: boolean;
    ema50AboveEma100: boolean;
    rsiOk: boolean;
    macdOk: boolean;
    mfiOk: boolean;
  };
  verdict: string;
}

export interface NewsItem {
  title: string;
  summary: string;
  category: string;
  sentiment: "positive" | "negative" | "neutral";
  time: string;
}

export interface PsychologyAnalysis {
  overallRating: string;
  strengths: string[];
  weaknesses: string[];
  recurringMistakes: string[];
  recommendations: string[];
  winRate: number;
  totalTrades: number;
}

export interface GamificationStats {
  winRate: number;
  totalPnL: number;
  currentStreak: number;
  badges: Badge[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
}
