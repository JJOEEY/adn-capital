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
  type: "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO";
  status: "RADAR" | "ACTIVE" | "CLOSED";
  tier: "LEADER" | "TRUNG_HAN" | "NGAN_HAN";
  entryPrice: number;
  target?: number | null;
  stoploss?: number | null;
  closePrice?: number | null;
  navAllocation: number;
  triggerSignal?: string | null;
  aiReasoning?: string | null;
  reason?: string | null;
  pnl?: number | null;
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
}

export interface JournalEntry {
  id: string;
  userId: string;
  ticker: string;
  action: "BUY" | "SELL";
  price: number;
  quantity: number;
  psychology: string;
  createdAt: string;
}

export type UserRole = "GUEST" | "FREE" | "VIP" | "ADMIN";

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
