/**
 * ADN Composite Score — Hệ thống đánh giá vĩ mô đa khung VN-INDEX
 * Tổng điểm tối đa: 14 (TA 10 + Định giá 4)
 *
 * A. Chart Tháng (M): 4đ
 * B. Chart Tuần  (W): 6đ
 * C. Định giá P/E P/B: 4đ
 *
 * Phân loại:
 *   ≥11   → Level 3 THIÊN THỜI (80-100% NAV, margin OK)
 *   6-10.5 → Level 2 THĂM DÒ   (30-50% NAV)
 *   <6    → Level 1 NGỦ ĐÔNG  (0-20% NAV)
 */

export interface CompositeScoreInput {
  taScore: number;       // 0-10 từ backend
  peRatio?: number | null;
  pbRatio?: number | null;
}

export interface ValuationBreakdown {
  peScore: number;
  pbScore: number;
  totalValuation: number;
}

export interface ActionRecommendation {
  status: "THIÊN THỜI" | "THĂM DÒ" | "NGỦ ĐÔNG";
  navAllocation: string;
  marginAllowed: boolean;
  level: 1 | 2 | 3;
}

export interface CompositeScoreResult {
  totalScore: number;
  maxScore: 14;
  taScore: number;
  taMax: 10;
  valuation: ValuationBreakdown;
  valuationMax: 4;
  action: ActionRecommendation;
}

function computeValuation(pe?: number | null, pb?: number | null): ValuationBreakdown {
  let peScore = 0;
  let pbScore = 0;

  if (pe != null) {
    if (pe < 11) peScore = 2.5;
    else if (pe <= 14) peScore = 1.5;
  }

  if (pb != null) {
    if (pb < 1.3) pbScore = 1.5;
    else if (pb <= 1.8) pbScore = 0.5;
  }

  return { peScore, pbScore, totalValuation: peScore + pbScore };
}

function getAction(score: number): ActionRecommendation {
  if (score >= 11) {
    return { status: "THIÊN THỜI", navAllocation: "80-100%", marginAllowed: true, level: 3 };
  }
  if (score >= 6) {
    return { status: "THĂM DÒ", navAllocation: "30-50%", marginAllowed: false, level: 2 };
  }
  return { status: "NGỦ ĐÔNG", navAllocation: "0-20%", marginAllowed: false, level: 1 };
}

export function calculateADNCompositeScore(input: CompositeScoreInput): CompositeScoreResult {
  const ta = Math.max(0, Math.min(10, input.taScore));
  const valuation = computeValuation(input.peRatio, input.pbRatio);
  const totalScore = Math.round((ta + valuation.totalValuation) * 10) / 10; // 1 decimal
  const clamped = Math.max(0, Math.min(14, totalScore));

  return {
    totalScore: clamped,
    maxScore: 14,
    taScore: ta,
    taMax: 10,
    valuation,
    valuationMax: 4,
    action: getAction(clamped),
  };
}
